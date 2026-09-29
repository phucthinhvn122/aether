import { ApiError, fetchExternalText, type ToolCall, type ToolSpec } from '../../lib/openai';
import { isNativeApp } from '../../lib/platform';
import type { ToolSource, ToolStep } from '../../lib/types';

const MAX_RESULTS = 6;
const PAGE_CHAR_CAP = 12_000;

export const WEB_TOOLS: ToolSpec[] = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description:
        'Search the web for current or factual information (news, prices, docs, recent events, anything you are unsure about). Returns titles, URLs and snippets.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query, in the language most likely to find good results.' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fetch_url',
      description: 'Read the text content of a web page, e.g. a promising search result or a URL the user shared.',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string', description: 'Absolute http(s) URL.' } },
        required: ['url'],
      },
    },
  },
];

interface SearchResult extends ToolSource {
  snippet: string;
}

function clean(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

/** DuckDuckGo wraps result links as //duckduckgo.com/l/?uddg=<encoded target>. */
function resolveDdgHref(href: string): string {
  try {
    const url = new URL(href, 'https://duckduckgo.com');
    const target = url.searchParams.get('uddg');
    return target ? decodeURIComponent(target) : url.toString();
  } catch {
    return href;
  }
}

function parseDdgHtml(html: string): SearchResult[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const results: SearchResult[] = [];
  for (const el of Array.from(doc.querySelectorAll('.result'))) {
    if (el.classList.contains('result--ad')) continue;
    const link = el.querySelector<HTMLAnchorElement>('a.result__a');
    const href = link?.getAttribute('href');
    if (!link || !href) continue;
    const url = resolveDdgHref(href);
    if (!/^https?:/i.test(url) || /duckduckgo\.com\/y\.js/.test(url)) continue;
    results.push({ title: clean(link.textContent), url, snippet: clean(el.querySelector('.result__snippet')?.textContent) });
  }
  return results;
}

function parseDdgLite(html: string): SearchResult[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const snippets = Array.from(doc.querySelectorAll('td.result-snippet')).map((s) => clean(s.textContent));
  return Array.from(doc.querySelectorAll<HTMLAnchorElement>('a.result-link'))
    .map((a, i) => ({ title: clean(a.textContent), url: resolveDdgHref(a.getAttribute('href') ?? ''), snippet: snippets[i] ?? '' }))
    .filter((r) => /^https?:/i.test(r.url));
}

function uniqueResults(list: SearchResult[]): SearchResult[] {
  return list.filter((r, i) => r.title && list.findIndex((o) => o.url === r.url) === i).slice(0, MAX_RESULTS);
}

/** Works from the phone and from a dev machine. DuckDuckGo answers 403 to datacenter IPs (the hosted proxy). */
async function searchDuckDuckGo(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const q = encodeURIComponent(query);
  const html = await fetchExternalText(`https://html.duckduckgo.com/html/?q=${q}`, signal);
  const results = uniqueResults(parseDdgHtml(html.text));
  if (results.length) return results;
  const lite = await fetchExternalText(`https://lite.duckduckgo.com/lite/?q=${q}`, signal);
  return uniqueResults(parseDdgLite(lite.text));
}

function parseBingRss(xml: string): SearchResult[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  return Array.from(doc.querySelectorAll('item')).map((item) => ({
    title: clean(item.querySelector('title')?.textContent),
    url: clean(item.querySelector('link')?.textContent),
    snippet: clean(item.querySelector('description')?.textContent),
  })).filter((r) => /^https?:/i.test(r.url) && !/bing\.com\/(?:search|ck\/)/i.test(r.url));
}

/** Works through the hosted proxy, where DuckDuckGo refuses the request. */
async function searchBing(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const q = encodeURIComponent(query);
  const rss = await fetchExternalText(`https://www.bing.com/search?q=${q}&format=rss&count=10`, signal);
  return uniqueResults(parseBingRss(rss.text));
}

export async function searchWeb(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  // The iOS app reaches DuckDuckGo directly and that already works. The website goes through
  // the Vercel proxy, which DuckDuckGo answers with 403, so it searches Bing first.
  const attempts = isNativeApp() ? [searchDuckDuckGo, searchBing] : [searchBing, searchDuckDuckGo];
  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      const results = await attempt(query, signal);
      if (results.length) return results;
    } catch (err) {
      if (signal?.aborted || (err instanceof ApiError && err.kind === 'aborted')) throw err;
      lastError = err;
    }
  }
  if (lastError) throw lastError;
  return [];
}

const BLOCK = 'p,div,section,article,li,tr,h1,h2,h3,h4,h5,h6,pre,blockquote,br,dt,dd,figcaption,header,footer';
const NOISE = 'script,style,noscript,svg,iframe,form,nav,aside,footer,header,template,button,[aria-hidden="true"]';

export function htmlToText(html: string): { title: string; text: string } {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const title = clean(doc.querySelector('title')?.textContent);
  const root = doc.querySelector('main, article, [role="main"]') ?? doc.body;
  if (!root) return { title, text: '' };
  root.querySelectorAll(NOISE).forEach((n) => n.remove());
  root.querySelectorAll(BLOCK).forEach((n) => n.append(doc.createTextNode('\n')));
  const text = (root.textContent ?? '')
    .split('\n')
    .map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
  return { title, text };
}

export async function fetchPage(url: string, signal?: AbortSignal): Promise<{ title: string; text: string }> {
  const res = await fetchExternalText(url, signal);
  const page = /html|xml/i.test(res.contentType) || /^\s*</.test(res.text) ? htmlToText(res.text) : { title: '', text: res.text };
  const text = page.text.length > PAGE_CHAR_CAP ? `${page.text.slice(0, PAGE_CHAR_CAP)}\n[…truncated]` : page.text;
  return { title: page.title, text };
}

function parseArgs(call: ToolCall): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(call.function.arguments || '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function stepFor(call: ToolCall): ToolStep {
  const args = parseArgs(call);
  const fetch = call.function.name === 'fetch_url';
  return {
    id: call.id,
    kind: fetch ? 'fetch' : 'search',
    label: String((fetch ? args.url : args.query) ?? '').trim(),
    status: 'running',
  };
}

/** Runs one tool call. Returns the text handed back to the model and the finished UI step. */
export async function runTool(call: ToolCall, signal?: AbortSignal): Promise<{ output: string; step: ToolStep }> {
  const step = stepFor(call);
  try {
    if (call.function.name === 'web_search') {
      if (!step.label) throw new Error('Missing "query".');
      const results = await searchWeb(step.label, signal);
      const output = results.length
        ? results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`).join('\n\n')
        : 'No results found.';
      return { output, step: { ...step, status: 'done', sources: results.map(({ title, url }) => ({ title, url })) } };
    }
    if (call.function.name === 'fetch_url') {
      if (!/^https?:\/\//i.test(step.label)) throw new Error('A full http(s) URL is required.');
      const page = await fetchPage(step.label, signal);
      return {
        output: `Title: ${page.title || '(none)'}\nURL: ${step.label}\n\n${page.text || '(no readable text)'}`,
        step: { ...step, status: 'done', sources: [{ title: page.title || step.label, url: step.label }] },
      };
    }
    throw new Error(`Unknown tool "${call.function.name}".`);
  } catch (err) {
    if (err instanceof ApiError && err.kind === 'aborted') throw err;
    const message = err instanceof Error ? err.message : String(err);
    return { output: `Error: ${message}`, step: { ...step, status: 'error', error: message } };
  }
}
