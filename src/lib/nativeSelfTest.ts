import { Capacitor } from '@capacitor/core';
import { streamChat } from './openai';

/**
 * CI-only smoke test (built with VITE_NATIVE_SELFTEST=1): streams a reply from the mock server
 * through the native URLSession plugin and logs the outcome for the simulator log to assert on.
 */
export async function runNativeSelfTest(): Promise<void> {
  const log = (msg: string) => console.info(`[aether-selftest] ${msg}`);
  log(`plugin available: ${Capacitor.isPluginAvailable('NativeHttpStream')}`);
  try {
    let chunks = 0;
    let text = '';
    const endpoint = { baseUrl: 'http://127.0.0.1:8788/v1', apiKey: '', useProxy: false };
    const messages = [{ role: 'user' as const, content: 'hello from the simulator' }];
    for await (const event of streamChat(endpoint, { model: 'mock-1', messages })) {
      if (event.type === 'content') {
        chunks++;
        text += event.text;
      }
    }
    log(chunks > 1 && text.length > 20 ? `ok chunks=${chunks} chars=${text.length}` : `FAILED only ${chunks} chunks`);
  } catch (err) {
    log(`FAILED ${err instanceof Error ? err.message : String(err)}`);
  }
}
