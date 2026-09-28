import { useCallback, useState } from 'react';
import { saveSettings } from '../../lib/db';
import { listModels } from '../../lib/openai';
import type { Settings } from '../../lib/types';

/** Cached GET /models list, keyed by base URL so switching providers refetches. */
export function useModelList(settings: Settings | undefined) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fresh = Boolean(settings && settings.modelCacheBaseUrl === settings.baseUrl && settings.modelCache.length > 0);
  const models = fresh && settings ? settings.modelCache : [];

  const refresh = useCallback(async () => {
    if (!settings?.baseUrl.trim()) return;
    setLoading(true);
    setError('');
    try {
      const list = await listModels(settings);
      await saveSettings({ modelCache: list, modelCacheBaseUrl: settings.baseUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [settings]);

  return { models, fresh, loading, error, refresh };
}
