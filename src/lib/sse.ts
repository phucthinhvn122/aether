/**
 * Reads a Server-Sent Events body and yields the payload of each `data:` line.
 * Stops at `[DONE]`. Comment lines (`: keep-alive`) and other fields are ignored.
 */
export async function* readSseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = done ? '' : (lines.pop() ?? '');
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data) continue;
        if (data === '[DONE]') return;
        yield data;
      }
      if (done) return;
    }
  } finally {
    reader.releaseLock();
  }
}
