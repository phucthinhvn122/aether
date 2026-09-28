import { useLiveQuery } from 'dexie-react-hooks';
import { DEFAULT_SETTINGS, db } from '../../lib/db';
import type { Settings } from '../../lib/types';

/** Returns undefined while loading. */
export function useSettings(): Settings | undefined {
  return useLiveQuery(async () => ({ ...DEFAULT_SETTINGS, ...(await db.settings.get('main')) }), []);
}

export function isConfigured(s: Settings | undefined): boolean {
  return Boolean(s && s.baseUrl.trim() && s.model.trim());
}
