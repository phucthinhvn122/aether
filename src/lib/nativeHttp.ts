import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { uid } from './id';

interface StartOptions {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

interface NativeHttpStreamPlugin {
  start(options: StartOptions): Promise<{ status: number; headers: Record<string, string> }>;
  cancel(options: { id: string }): Promise<void>;
  addListener(event: 'chunk', cb: (e: { id: string; data: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'end', cb: (e: { id: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'error', cb: (e: { id: string; message: string }) => void): Promise<PluginListenerHandle>;
}

/** Implemented in ios/App/App/NativeHttpStreamPlugin.swift. */
const NativeHttpStream = registerPlugin<NativeHttpStreamPlugin>('NativeHttpStream');

const streams = new Map<string, ReadableStreamDefaultController<Uint8Array>>();
let listening: Promise<unknown> | null = null;

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function finish(id: string, err?: unknown) {
  const controller = streams.get(id);
  streams.delete(id);
  if (!controller) return;
  try {
    if (err) controller.error(err);
    else controller.close();
  } catch {
    // stream already closed or cancelled by the reader
  }
}

function ensureListeners(): Promise<unknown> {
  listening ??= Promise.all([
    NativeHttpStream.addListener('chunk', ({ id, data }) => {
      try {
        streams.get(id)?.enqueue(base64ToBytes(data));
      } catch {
        finish(id);
      }
    }),
    NativeHttpStream.addListener('end', ({ id }) => finish(id)),
    NativeHttpStream.addListener('error', ({ id, message }) =>
      finish(id, message === 'aborted' ? new DOMException('Aborted', 'AbortError') : new TypeError(message)),
    ),
  ]);
  return listening;
}

const NULL_BODY_STATUS = new Set([101, 204, 205, 304]);

export interface NativeRequestInit {
  method: string;
  headers: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

/**
 * fetch() replacement for the native app: the request runs in URLSession (no CORS),
 * and the body is exposed as a real ReadableStream so SSE still streams token by token.
 */
export async function nativeFetch(url: string, init: NativeRequestInit): Promise<Response> {
  if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  await ensureListeners();

  const id = uid();
  // Created before `start` so chunks that arrive right after the headers are never dropped.
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      streams.set(id, controller);
    },
    cancel() {
      streams.delete(id);
      void NativeHttpStream.cancel({ id });
    },
  });

  const onAbort = () => {
    void NativeHttpStream.cancel({ id });
    finish(id, new DOMException('Aborted', 'AbortError'));
  };
  init.signal?.addEventListener('abort', onAbort, { once: true });

  let head: { status: number; headers: Record<string, string> };
  try {
    head = await NativeHttpStream.start({ id, url, method: init.method, headers: init.headers, body: init.body });
  } catch (err) {
    streams.delete(id);
    init.signal?.removeEventListener('abort', onAbort);
    if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    throw new TypeError(err instanceof Error ? err.message : String(err));
  }

  const headers = new Headers();
  for (const [name, value] of Object.entries(head.headers ?? {})) {
    try {
      headers.append(name, value);
    } catch {
      // skip header values the Fetch API rejects
    }
  }
  const status = head.status >= 200 && head.status <= 599 ? head.status : 502;
  if (NULL_BODY_STATUS.has(status)) {
    void body.cancel();
    return new Response(null, { status, headers });
  }
  return new Response(body, { status, headers });
}
