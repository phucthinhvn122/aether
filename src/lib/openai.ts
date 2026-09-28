import { uid } from './id';
import { nativeFetch, nativeHttpAvailable } from './nativeHttp';
import { isNativeApp, proxyAvailable } from './platform';
import { readSseData } from './sse';
import { strings } from './strings';

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ToolSpec {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export type ChatMessage =
  | { role: 'system' | 'user'; content: string | ContentPart[] }
  | { role: 'assistant'; content: string | ContentPart[] | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export interface Endpoint {
  baseUrl: string;
  apiKey: string;
  useProxy: boolean;
}

export type ApiErrorKind =
  | 'auth'
  | 'forbidden'
  | 'model'
  | 'notFound'
  | 'rateLimit'
  | 'badRequest'
  | 'server'
  | 'cors'
  | 'network'
  | 'proxy'
  | 'config'
  | 'aborted';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

export type StreamEvent =
  | { type: 'content'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_calls'; calls: ToolCall[] };

export const PROXY_PATH = './api/proxy';

export function joinUrl(base: string, path: string): string {
  return `${base.trim().replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function buildHeaders(endpoint: Endpoint, json: boolean): Record<string, string> {
  const headers: Record<string, string> = {};
  if (json) headers['Content-Type'] = 'application/json';
  const key = endpoint.apiKey.trim();
  if (key) headers.Authorization = `Bearer ${key}`;
  if (/openrouter\.ai/i.test(endpoint.baseUrl)) {
    headers['HTTP-Referer'] = window.location.origin;
    headers['X-Title'] = 'Aether';
  }
  return headers;
}

async function request(
  endpoint: Endpoint,
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal; accept?: string },
): Promise<Response> {
  if (!endpoint.baseUrl.trim()) throw new ApiError('config', strings.errors.config);
  let target: string;
  try {
    target = new URL(joinUrl(endpoint.baseUrl, path)).toString();
  } catch {
    throw new ApiError('config', `Invalid Base URL: ${endpoint.baseUrl}`);
  }

  const headers = buildHeaders(endpoint, init.body !== undefined);
  if (init.accept) headers.Accept = init.accept;
  const native = isNativeApp() && nativeHttpAvailable();
  let viaProxy = !native && (endpoint.useProxy || proxyRescuedCors) && proxyAvailable();

  const requestInit = (proxied: boolean) => ({
    method: init.method,
    headers: proxied ? { ...headers, 'x-aether-target': target } : headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: init.signal,
  });

  let res: Response;
  try {
    // Inside the iOS app requests go through URLSession, which is not subject to CORS.
    res = native
      ? await nativeFetch(target, requestInit(false))
      : await fetch(viaProxy ? PROXY_PATH : target, requestInit(viaProxy));
  } catch (err) {
    if (init.signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      throw new ApiError('aborted', strings.chat.stopped);
    }
    if (!navigator.onLine) throw new ApiError('network', strings.errors.network);
    if (native) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new ApiError('network', `${strings.errors.networkNative}${reason ? `\n${reason}` : ''}`);
    }
    if (viaProxy) throw new ApiError('proxy', strings.errors.proxyUnavailable);
    const rescued = await tryProxy(requestInit(true));
    if (init.signal?.aborted) throw new ApiError('aborted', strings.chat.stopped);
    if (!rescued) throw new ApiError('cors', strings.errors.cors);
    proxyRescuedCors = true;
    viaProxy = true;
    res = rescued;
  }

  if (!res.ok) throw await toApiError(res, viaProxy);
  return res;
}

/** Set once the same-origin relay (Vite dev server, npm run serve, or Vercel /api/proxy) rescued a CORS-blocked call. */
let proxyRescuedCors = false;

/** Retries a CORS-blocked request through the relay; null when the host has no relay (plain static hosting). */
async function tryProxy(init: RequestInit): Promise<Response | null> {
  if (!proxyAvailable()) return null;
  try {
    const res = await fetch(PROXY_PATH, init);
    const html = (res.headers.get('content-type') ?? '').includes('text/html');
    if (html && (res.status === 404 || res.status === 405)) return null;
    return res;
  } catch {
    return null;
  }
}

async function toApiError(res: Response, viaProxy: boolean): Promise<ApiError> {
  // Static hosts (GitHub Pages, Netlify…) answer /api/proxy with an HTML 404/405 page.
  const htmlReply = (res.headers.get('content-type') ?? '').includes('text/html');
  if (viaProxy && htmlReply && (res.status === 404 || res.status === 405)) {
    return new ApiError('proxy', strings.errors.proxyUnavailable, res.status);
  }
  let detail = '';
  try {
    const text = await res.text();
    try {
      const json = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
      detail =
        (typeof json.error === 'string' ? json.error : json.error?.message) ?? json.message ?? text;
    } catch {
      detail = text;
    }
  } catch {
    detail = '';
  }
  detail = detail.replace(/\s+/g, ' ').trim().slice(0, 400);
  const withDetail = (base: string) => (detail ? `${base}\n${detail}` : base);
  const mentionsModel = /model/i.test(detail) && /(not.?found|does not exist|unknown|invalid|no such|not available|not supported)/i.test(detail);

  switch (true) {
    case res.status === 401:
      return new ApiError('auth', withDetail(strings.errors.auth), 401);
    case res.status === 403:
      return new ApiError('forbidden', withDetail(strings.errors.forbidden), 403);
    case mentionsModel:
      return new ApiError('model', withDetail(strings.errors.model), res.status);
    case res.status === 404 && viaProxy && !detail:
      return new ApiError('proxy', strings.errors.proxyUnavailable, 404);
    case res.status === 404:
      return new ApiError('notFound', withDetail(strings.errors.notFound), 404);
    case res.status === 429:
      return new ApiError('rateLimit', withDetail(strings.errors.rateLimit), 429);
    case res.status === 502 && viaProxy:
      return new ApiError('network', withDetail(strings.errors.network), 502);
    case res.status >= 400 && res.status < 500:
      return new ApiError('badRequest', withDetail(`${strings.errors.server} (${res.status}).`), res.status);
    default:
      return new ApiError('server', withDetail(`${strings.errors.server} (${res.status}).`), res.status);
  }
}

interface ToolCallDelta {
  index?: number;
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
}

interface ChoiceDelta {
  content?: string | null;
  reasoning_content?: string | null;
  reasoning?: string | null;
  thinking?: string | null;
  tool_calls?: ToolCallDelta[] | null;
}

interface StreamChunk {
  choices?: Array<{ delta?: ChoiceDelta; message?: ChoiceDelta }>;
  error?: { message?: string } | string;
}

function thinkingOf(d: ChoiceDelta | undefined): string {
  return d?.reasoning_content || d?.reasoning || d?.thinking || '';
}

/** Merges streamed tool-call fragments (keyed by index) into complete calls. */
class ToolCallAccumulator {
  private calls: ToolCall[] = [];

  add(deltas: ToolCallDelta[]): void {
    for (const d of deltas) {
      const i = d.index ?? this.calls.length;
      const call = (this.calls[i] ??= { id: '', type: 'function', function: { name: '', arguments: '' } });
      if (d.id) call.id = d.id;
      if (d.function?.name) call.function.name += d.function.name;
      if (d.function?.arguments) call.function.arguments += d.function.arguments;
    }
  }

  result(): ToolCall[] {
    return this.calls
      .filter((c) => c?.function.name)
      .map((c) => ({ ...c, id: c.id || `call_${uid()}` }));
  }
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolSpec[];
  /** Provider-specific body fields (e.g. reasoning_effort). */
  extraBody?: Record<string, unknown>;
}

/** Body fields for a thinking-effort choice. "auto" adds nothing so non-reasoning models are unaffected. */
export function reasoningParams(baseUrl: string, effort: 'auto' | 'low' | 'medium' | 'high'): Record<string, unknown> {
  if (effort === 'auto') return {};
  if (/openrouter\.ai/i.test(baseUrl)) return { reasoning: { effort } };
  return { reasoning_effort: effort };
}

/** POST {baseUrl}/chat/completions with stream: true, yielding content and reasoning deltas. */
export async function* streamChat(endpoint: Endpoint, req: ChatRequest): AsyncGenerator<StreamEvent> {
  const res = await request(endpoint, 'chat/completions', {
    method: 'POST',
    signal: req.signal,
    accept: 'text/event-stream',
    body: {
      ...req.extraBody,
      model: req.model,
      messages: req.messages,
      stream: true,
      ...(req.temperature !== undefined && { temperature: req.temperature }),
      ...(req.maxTokens !== undefined && { max_tokens: req.maxTokens }),
      ...(req.tools?.length && { tools: req.tools }),
    },
  });

  const toolCalls = new ToolCallAccumulator();
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    // Some servers ignore stream:true and answer with a single JSON body.
    const json = (await res.json()) as StreamChunk;
    const msg = json.choices?.[0]?.message;
    const thinking = thinkingOf(msg);
    if (thinking) yield { type: 'thinking', text: thinking };
    if (msg?.content) yield { type: 'content', text: msg.content };
    if (msg?.tool_calls) toolCalls.add(msg.tool_calls);
    const calls = toolCalls.result();
    if (calls.length) yield { type: 'tool_calls', calls };
    return;
  }
  if (!res.body) throw new ApiError('server', strings.errors.emptyResponse);

  try {
    for await (const data of readSseData(res.body)) {
      let chunk: StreamChunk;
      try {
        chunk = JSON.parse(data) as StreamChunk;
      } catch {
        continue;
      }
      if (chunk.error) {
        const message = typeof chunk.error === 'string' ? chunk.error : (chunk.error.message ?? 'Unknown error');
        throw new ApiError('server', `${strings.errors.server}.\n${message}`);
      }
      const delta = chunk.choices?.[0]?.delta;
      const thinking = thinkingOf(delta);
      if (thinking) yield { type: 'thinking', text: thinking };
      if (delta?.content) yield { type: 'content', text: delta.content };
      if (delta?.tool_calls) toolCalls.add(delta.tool_calls);
    }
  } catch (err) {
    if (req.signal?.aborted) throw new ApiError('aborted', strings.chat.stopped);
    if (err instanceof ApiError) throw err;
    throw new ApiError('network', strings.errors.network);
  }
  const calls = toolCalls.result();
  if (calls.length) yield { type: 'tool_calls', calls };
}

/**
 * GET a third-party page (search results, articles) as text. Uses URLSession in the iOS app,
 * otherwise the same-origin relay, since such sites never send CORS headers.
 */
export async function fetchExternalText(url: string, signal?: AbortSignal): Promise<{ text: string; contentType: string; url: string }> {
  const headers: Record<string, string> = { Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5' };
  let res: Response;
  try {
    if (isNativeApp() && nativeHttpAvailable()) {
      res = await nativeFetch(url, { method: 'GET', headers, signal });
    } else if (proxyAvailable()) {
      res = await fetch(PROXY_PATH, { method: 'GET', headers: { ...headers, 'x-aether-target': url }, signal });
    } else {
      res = await fetch(url, { headers, signal });
    }
  } catch (err) {
    if (signal?.aborted) throw new ApiError('aborted', strings.chat.stopped);
    throw new ApiError('network', err instanceof Error ? err.message : String(err));
  }
  const contentType = res.headers.get('content-type') ?? '';
  const text = await res.text();
  if (!res.ok) throw new ApiError(res.status === 404 ? 'notFound' : 'server', `HTTP ${res.status}`, res.status);
  return { text, contentType, url };
}

/** Non-streaming completion (used for auto-titles and connection tests). */
export async function completeChat(endpoint: Endpoint, req: ChatRequest): Promise<string> {
  const res = await request(endpoint, 'chat/completions', {
    method: 'POST',
    signal: req.signal,
    body: {
      model: req.model,
      messages: req.messages,
      stream: false,
      ...(req.temperature !== undefined && { temperature: req.temperature }),
      ...(req.maxTokens !== undefined && { max_tokens: req.maxTokens }),
    },
  });
  const json = (await res.json()) as StreamChunk;
  return json.choices?.[0]?.message?.content ?? '';
}

export async function listModels(endpoint: Endpoint, signal?: AbortSignal): Promise<string[]> {
  const res = await request(endpoint, 'models', { method: 'GET', signal });
  const json = (await res.json()) as { data?: Array<{ id?: string }>; models?: Array<{ id?: string; name?: string }> };
  const list = json.data ?? json.models ?? [];
  return list
    .map((m) => ('id' in m && m.id) || ('name' in m && m.name) || '')
    .filter((id): id is string => Boolean(id))
    .sort((a, b) => a.localeCompare(b));
}

export type TestResult = { ok: true; via: 'models'; count: number } | { ok: true; via: 'chat' };

/** GET /models when supported, otherwise a tiny chat ping. */
export async function testConnection(endpoint: Endpoint, model: string, signal?: AbortSignal): Promise<TestResult> {
  try {
    const models = await listModels(endpoint, signal);
    if (models.length > 0 || !model) return { ok: true, via: 'models', count: models.length };
  } catch (err) {
    if (err instanceof ApiError && ['auth', 'forbidden', 'cors', 'proxy', 'network', 'config', 'aborted'].includes(err.kind)) {
      throw err;
    }
    if (!model) throw err;
  }
  await completeChat(endpoint, {
    model,
    messages: [{ role: 'user', content: 'ping' }],
    maxTokens: 5,
    signal,
  });
  return { ok: true, via: 'chat' };
}
