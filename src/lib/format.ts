export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const DAY = 24 * 60 * 60 * 1000;

export type DateGroup = 'today' | 'yesterday' | 'week' | 'older';

export function dateGroup(ts: number, now = Date.now()): DateGroup {
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  if (ts >= startOfToday) return 'today';
  if (ts >= startOfToday - DAY) return 'yesterday';
  if (ts >= startOfToday - 7 * DAY) return 'week';
  return 'older';
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
