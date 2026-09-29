// Vercel Function: same-origin streaming relay for OpenAI-compatible servers without CORS headers.
// The browser sends the real URL in `x-aether-target` (see src/lib/openai.ts).
// Optional env PROXY_ALLOWED_HOSTS="api.example.com,openrouter.ai" restricts which hosts may be reached.

const FORWARD_HEADERS = ['authorization', 'content-type', 'accept', 'http-referer', 'x-title'];

function json(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** This relay is public, so never let it reach loopback, link-local or private networks. */
export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h === '::1' || h === '::' || /^f[cd][0-9a-f]{2}:/.test(h) || h.startsWith('fe80:')) return true;
  const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (!v4) return false;
  const [a, b] = [Number(v4[1]), Number(v4[2])];
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

function allowedByEnv(hostname: string): boolean {
  const list = (process.env.PROXY_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.length === 0 || list.includes(hostname.toLowerCase());
}

async function relay(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return json(403, 'Cross-origin use of this proxy is not allowed.');
  }

  let target: URL;
  try {
    target = new URL(request.headers.get('x-aether-target') ?? '');
  } catch {
    return json(400, 'Missing or invalid x-aether-target header.');
  }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') return json(400, 'Only http(s) targets are allowed.');
  if (isPrivateHost(target.hostname)) {
    return json(403, 'The hosted proxy cannot reach localhost or private networks. Run Aether locally (npm run dev) for Ollama / LM Studio.');
  }
  if (!allowedByEnv(target.hostname)) return json(403, `Host ${target.hostname} is not in PROXY_ALLOWED_HOSTS.`);

  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  let current = target;
  let method = request.method;
  let body: ArrayBuffer | undefined = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();

  for (let hop = 0; hop < 4; hop++) {
    let upstream: Response;
    try {
      upstream = await fetch(current, { method, headers, body, signal: request.signal, redirect: 'manual' });
    } catch (err) {
      const reason = err instanceof Error ? ((err.cause as { code?: string } | undefined)?.code ?? err.message) : String(err);
      return json(502, `Proxy could not reach ${current.origin} (${reason}).`);
    }

    if (upstream.status !== 301 && upstream.status !== 302 && upstream.status !== 303 && upstream.status !== 307 && upstream.status !== 308) {
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
          'cache-control': 'no-cache, no-transform',
          'x-accel-buffering': 'no',
        },
      });
    }

    const next = upstream.headers.get('location');
    await upstream.body?.cancel();
    if (!next) return json(502, `Redirect from ${current.host} had no Location header.`);
    let nextUrl: URL;
    try {
      nextUrl = new URL(next, current);
    } catch {
      return json(502, `Redirect from ${current.host} was not a valid URL.`);
    }
    if (nextUrl.protocol !== 'https:' && nextUrl.protocol !== 'http:') return json(400, 'Only http(s) targets are allowed.');
    if (isPrivateHost(nextUrl.hostname)) return json(403, 'The hosted proxy cannot follow a redirect to a private network.');
    if (!allowedByEnv(nextUrl.hostname)) return json(403, `Host ${nextUrl.hostname} is not in PROXY_ALLOWED_HOSTS.`);
    // 301/302/303 become GET. 307/308 keep the method and body.
    if (upstream.status !== 307 && upstream.status !== 308) {
      method = 'GET';
      body = undefined;
    }
    current = nextUrl;
  }
  return json(502, 'Too many redirects.');
}

export function GET(request: Request): Promise<Response> {
  return relay(request);
}

export function POST(request: Request): Promise<Response> {
  return relay(request);
}
