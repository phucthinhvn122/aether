/** "openai/gpt-4o-mini" → { name: "gpt-4o-mini", vendor: "openai" }. */
export function splitModelId(id: string): { name: string; vendor?: string } {
  const slash = id.lastIndexOf('/');
  if (slash <= 0) return { name: id };
  return { name: id.slice(slash + 1), vendor: id.slice(0, slash) };
}
