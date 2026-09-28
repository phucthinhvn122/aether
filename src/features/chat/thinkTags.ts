const OPEN = /^\s*<(think|thinking|reasoning)>/i;

/**
 * Some models (e.g. DeepSeek-R1 on Ollama) stream reasoning inline as <think>…</think>
 * instead of a separate delta field. Split it out so it renders in the Thinking block.
 */
export function splitInlineThinking(raw: string): { content: string; thinking: string } {
  const open = OPEN.exec(raw);
  if (!open) return { content: raw, thinking: '' };
  const tag = open[1];
  const rest = raw.slice(open[0].length);
  const closeRe = new RegExp(`</${tag}>`, 'i');
  const close = closeRe.exec(rest);
  if (!close) return { content: '', thinking: rest.trimStart() };
  return {
    thinking: rest.slice(0, close.index).trim(),
    content: rest.slice(close.index + close[0].length).trimStart(),
  };
}
