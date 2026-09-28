import { strings } from '../../lib/strings';
import type { ArtifactBlock, ArtifactType, Segment } from './types';

const OPEN_DIRECTIVE = /^\s*:::artifact\b(.*)$/i;
const CLOSE_DIRECTIVE = /^\s*:::\s*$/;
const FENCE_OPEN = /^\s{0,3}(`{3,}|~{3,})\s*([^\s`]*)/;

const HTML_LANGS = new Set(['html', 'htm', 'svg', 'xhtml']);
const MARKDOWN_LANGS = new Set(['markdown', 'md', 'mdx']);
const MIN_DOC_LINES = 8;
const MIN_CODE_LINES = 40;
const MIN_UNTAGGED_LINES = 60;

function parseAttrs(input: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input))) attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  return attrs;
}

function isFenceClose(line: string, marker: string): boolean {
  const t = line.trim();
  return t.length >= marker.length && t[0] === marker[0] && /^(`+|~+)$/.test(t);
}

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'untitled'
  );
}

/** Models sometimes wrap the directive body in a code fence anyway; unwrap it. */
function unwrapFence(body: string): string {
  const lines = body.replace(/^\n+/, '').split('\n');
  const open = FENCE_OPEN.exec(lines[0] ?? '');
  if (!open) return body;
  const closeIdx = lines.findIndex((l, i) => i > 0 && isFenceClose(l, open[1]));
  if (closeIdx === -1) return lines.slice(1).join('\n');
  if (lines.slice(closeIdx + 1).some((l) => l.trim())) return body;
  return lines.slice(1, closeIdx).join('\n');
}

function inferType(declared: string | undefined, language: string | undefined): ArtifactType {
  if (declared === 'html' || declared === 'markdown' || declared === 'code') return declared;
  if (declared === 'md' || (language && MARKDOWN_LANGS.has(language))) return 'markdown';
  if (declared === 'svg' || (language && HTML_LANGS.has(language))) return 'html';
  return 'code';
}

function guessTitle(type: ArtifactType, content: string, language?: string): string {
  if (type === 'html') {
    const t = /<title[^>]*>([^<]+)<\/title>/i.exec(content)?.[1] ?? /<h1[^>]*>([^<]+)<\/h1>/i.exec(content)?.[1];
    if (t?.trim()) return t.trim();
  }
  if (type === 'markdown') {
    const h = /^#{1,3}\s+(.+)$/m.exec(content)?.[1];
    if (h?.trim()) return h.replace(/[*_`]/g, '').trim();
  }
  if (type === 'code' && language) return `${language} ${strings.artifacts.defaultTitle.code.toLowerCase()}`;
  return strings.artifacts.defaultTitle[type];
}

function fallbackType(lang: string, code: string, lines: number): ArtifactType | null {
  if (HTML_LANGS.has(lang)) {
    const fullDoc = /<!doctype html|<html[\s>]/i.test(code);
    if (fullDoc || (lines >= MIN_DOC_LINES && /<(body|div|main|section|svg|script|style)\b/i.test(code))) return 'html';
    return null;
  }
  if (MARKDOWN_LANGS.has(lang)) return lines >= MIN_DOC_LINES ? 'markdown' : null;
  if (lang && lines >= MIN_CODE_LINES) return 'code';
  if (!lang && lines >= MIN_UNTAGGED_LINES) return 'code';
  return null;
}

/**
 * Splits assistant markdown into text and artifact segments.
 * Handles `:::artifact` directives and falls back to large html/markdown/code fences.
 * Unclosed blocks (still streaming) are returned with `complete: false`.
 */
export function parseSegments(content: string, messageId: string): Segment[] {
  const lines = content.split('\n');
  const segments: Segment[] = [];
  const usedIds = new Map<string, number>();
  let text: string[] = [];

  const flushText = () => {
    const joined = text.join('\n');
    if (joined.trim()) segments.push({ kind: 'text', text: joined });
    text = [];
  };
  const uniqueId = (id: string) => {
    const n = usedIds.get(id) ?? 0;
    usedIds.set(id, n + 1);
    return n === 0 ? id : `${id}-${n + 1}`;
  };
  const pushArtifact = (artifact: ArtifactBlock) => {
    flushText();
    segments.push({ kind: 'artifact', artifact: { ...artifact, id: uniqueId(artifact.id) } });
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    const directive = OPEN_DIRECTIVE.exec(line);
    if (directive) {
      const attrs = parseAttrs(directive[1]);
      const body: string[] = [];
      let fence: string | null = null;
      let j = i + 1;
      let closed = false;
      for (; j < lines.length; j++) {
        const l = lines[j];
        if (fence) {
          if (isFenceClose(l, fence)) fence = null;
        } else {
          const f = FENCE_OPEN.exec(l);
          if (f) fence = f[1];
          else if (CLOSE_DIRECTIVE.test(l)) {
            closed = true;
            break;
          }
        }
        body.push(l);
      }
      const language = attrs.language?.toLowerCase() || undefined;
      const type = inferType(attrs.type?.toLowerCase(), language);
      const contentText = unwrapFence(body.join('\n'));
      const title = attrs.title?.trim() || guessTitle(type, contentText, language);
      pushArtifact({
        id: attrs.id?.trim() || `${messageId}-${slug(title)}`,
        title,
        type,
        language,
        content: contentText,
        complete: closed,
      });
      i = closed ? j + 1 : j;
      continue;
    }

    const fenceOpen = FENCE_OPEN.exec(line);
    if (fenceOpen) {
      const marker = fenceOpen[1];
      const lang = (fenceOpen[2] ?? '').toLowerCase();
      let j = i + 1;
      let closed = false;
      for (; j < lines.length; j++) {
        if (isFenceClose(lines[j], marker)) {
          closed = true;
          break;
        }
      }
      const bodyLines = lines.slice(i + 1, j);
      const code = bodyLines.join('\n');
      const type = fallbackType(lang, code, bodyLines.length);
      if (type) {
        const language = type === 'code' ? lang || undefined : undefined;
        const title = guessTitle(type, code, language);
        pushArtifact({ id: `auto-${type}-${slug(title)}`, title, type, language, content: code, complete: closed });
      } else {
        text.push(...lines.slice(i, closed ? j + 1 : j));
      }
      i = closed ? j + 1 : j;
      continue;
    }

    text.push(line);
    i++;
  }
  flushText();
  return segments;
}

const cache = new Map<string, { content: string; segments: Segment[] }>();

/** Memoized per message so streaming only re-parses the message that changed. */
export function parseSegmentsCached(content: string, messageId: string): Segment[] {
  const hit = cache.get(messageId);
  if (hit && hit.content === content) return hit.segments;
  const segments = parseSegments(content, messageId);
  cache.set(messageId, { content, segments });
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  return segments;
}

const EXTENSIONS: Record<string, string> = {
  javascript: 'js', js: 'js', jsx: 'jsx', typescript: 'ts', ts: 'ts', tsx: 'tsx', python: 'py', py: 'py',
  rust: 'rs', go: 'go', java: 'java', kotlin: 'kt', swift: 'swift', ruby: 'rb', php: 'php', c: 'c',
  cpp: 'cpp', 'c++': 'cpp', csharp: 'cs', cs: 'cs', css: 'css', scss: 'scss', json: 'json', yaml: 'yml',
  yml: 'yml', sql: 'sql', bash: 'sh', sh: 'sh', shell: 'sh', xml: 'xml', vue: 'vue', svelte: 'svelte',
  dart: 'dart', lua: 'lua', r: 'r', toml: 'toml',
};

export function artifactExtension(a: Pick<ArtifactBlock, 'type' | 'language'>): string {
  if (a.type === 'html') return 'html';
  if (a.type === 'markdown') return 'md';
  return EXTENSIONS[a.language ?? ''] ?? 'txt';
}
