// Thin same-origin relay so the browser can reach OpenAI-compatible servers
// that do not send CORS headers. The target URL comes from `x-aether-target`.

export const PROXY_PATH = '/api/proxy';

const FORWARD_HEADERS = ['authorization', 'content-type', 'accept', 'http-referer', 'x-title'];

function sendJson(res, status, payload) {
  if (res.headersSent) return res.end();
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export async function handleProxy(req, res) {
  const target = req.headers['x-aether-target'];
  if (typeof target !== 'string' || !/^https?:\/\//i.test(target)) {
    return sendJson(res, 400, { error: { message: 'Missing or invalid x-aether-target header.' } });
  }

  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });

  const method = req.method ?? 'GET';
  const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(req);

  const headers = {};
  for (const name of FORWARD_HEADERS) {
    const value = req.headers[name];
    if (typeof value === 'string' && value) headers[name] = value;
  }

  let upstream;
  try {
    upstream = await fetch(target, { method, headers, body, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) return res.end();
    const reason = err?.cause?.code ?? err?.message ?? 'unknown error';
    return sendJson(res, 502, {
      error: { message: `Proxy could not reach ${new URL(target).origin} (${reason}).` },
    });
  }

  res.statusCode = upstream.status;
  const contentType = upstream.headers.get('content-type');
  if (contentType) res.setHeader('content-type', contentType);
  res.setHeader('cache-control', 'no-cache');
  res.setHeader('x-accel-buffering', 'no');
  res.flushHeaders?.();

  if (!upstream.body) return res.end();
  try {
    for await (const chunk of upstream.body) res.write(chunk);
  } catch {
    // client aborted or upstream dropped; nothing else to do
  }
  res.end();
}
