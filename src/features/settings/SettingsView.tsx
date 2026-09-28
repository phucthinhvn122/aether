import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '../../components/Button';
import { TextAreaField, TextField, Toggle } from '../../components/Field';
import { IconButton } from '../../components/IconButton';
import { PageHeader } from '../../components/PageHeader';
import { SkeletonLines } from '../../components/Skeleton';
import { db, saveSettings } from '../../lib/db';
import { navigate } from '../../lib/router';
import { strings } from '../../lib/strings';
import type { Settings } from '../../lib/types';
import { cn } from '../../lib/cn';
import { isNativeApp } from '../../lib/platform';
import { ConnectionTest } from './ConnectionTest';
import { EffortPicker } from './EffortPicker';
import { ModelPicker } from './ModelPicker';
import { PRESETS } from './presets';
import { useSettings } from './useSettings';

type Draft = Omit<Settings, 'id'>;

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-line bg-surface/60 p-4 sm:p-6">
      <div>
        <h2 className="font-serif text-lg font-semibold text-ink">{title}</h2>
        {hint && <p className="mt-1 text-sm text-ink-faint">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function SettingsView() {
  const settings = useSettings();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showKey, setShowKey] = useState(false);
  const native = isNativeApp();
  const [savedAt, setSavedAt] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (settings && !draft) {
      const { id: _id, ...rest } = settings;
      setDraft(rest);
    }
  }, [settings, draft]);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (Object.keys(pending.current).length) void saveSettings(pending.current);
    },
    [],
  );

  const pending = useRef<Partial<Draft>>({});

  const update = (patch: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    pending.current = { ...pending.current, ...patch };
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const toSave = pending.current;
      pending.current = {};
      await saveSettings(toSave);
      setSavedAt(Date.now());
    }, 250);
  };

  const endpoint = useMemo(
    () => ({ baseUrl: draft?.baseUrl ?? '', apiKey: draft?.apiKey ?? '', useProxy: draft?.useProxy ?? false }),
    [draft?.baseUrl, draft?.apiKey, draft?.useProxy],
  );

  const clearAll = async () => {
    if (!window.confirm(strings.settings.confirmClearAll)) return;
    await db.transaction('rw', db.conversations, db.messages, async () => {
      await db.messages.clear();
      await db.conversations.clear();
    });
    navigate({ name: 'new' });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={strings.settings.title}
        actions={savedAt > 0 && <span className="px-2 text-xs text-ink-faint animate-fade-in">{strings.common.saved}</span>}
      />
      <div className="scroll-area pb-safe min-h-0 flex-1">
        <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6 sm:py-10">
          {!draft ? (
            <SkeletonLines lines={6} />
          ) : (
            <>
              <Section title={strings.settings.backend} hint={strings.settings.backendHint}>
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-ink">{strings.settings.presets}</span>
                  <div className="flex flex-wrap gap-2">
                    {PRESETS.map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => update({ baseUrl: p.baseUrl })}
                        className={cn(
                          'min-h-11 rounded-full border px-4 text-sm transition-colors lg:min-h-9',
                          draft.baseUrl === p.baseUrl
                            ? 'border-accent bg-accent-soft text-accent-strong'
                            : 'border-line bg-surface text-ink-soft hover:bg-muted',
                        )}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                <TextField
                  label={strings.settings.baseUrl}
                  value={draft.baseUrl}
                  onChange={(e) => update({ baseUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                  inputMode="url"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />

                <TextField
                  label={strings.settings.apiKey}
                  hint={strings.settings.apiKeyHint}
                  type={showKey ? 'text' : 'password'}
                  value={draft.apiKey}
                  onChange={(e) => update({ apiKey: e.target.value })}
                  placeholder="sk-…"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  adornment={
                    <IconButton
                      label={showKey ? strings.settings.hideKey : strings.settings.showKey}
                      onClick={() => setShowKey((v) => !v)}
                      size="sm"
                    >
                      {showKey ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                    </IconButton>
                  }
                />

                <ModelPicker
                  value={draft.model}
                  onChange={(model) => update({ model })}
                  endpoint={endpoint}
                  initialModels={draft.modelCacheBaseUrl === draft.baseUrl ? draft.modelCache : []}
                  onModelsLoaded={(modelCache) => update({ modelCache, modelCacheBaseUrl: draft.baseUrl })}
                />

                <EffortPicker value={draft.reasoningEffort} onChange={(reasoningEffort) => update({ reasoningEffort })} />

                {native ? (
                  <Toggle label={strings.settings.useProxy} hint={strings.settings.useProxyNative} checked={false} onChange={() => undefined} disabled />
                ) : (
                  <Toggle
                    label={strings.settings.useProxy}
                    hint={strings.settings.useProxyHint}
                    checked={draft.useProxy}
                    onChange={(useProxy) => update({ useProxy })}
                  />
                )}
                <Toggle
                  label={strings.settings.vision}
                  hint={strings.settings.visionHint}
                  checked={draft.vision}
                  onChange={(vision) => update({ vision })}
                />

                <ConnectionTest endpoint={endpoint} model={draft.model} />
              </Section>

              <Section title={strings.settings.instructions} hint={strings.settings.instructionsHint}>
                <TextAreaField
                  label={strings.settings.instructions}
                  value={draft.instructions}
                  onChange={(e) => update({ instructions: e.target.value })}
                  placeholder={strings.settings.instructionsPlaceholder}
                  rows={6}
                />
              </Section>

              <Section title={strings.settings.data} hint={strings.settings.dataHint}>
                <Button variant="danger" onClick={clearAll} className="self-start">
                  <Trash2 className="size-4" aria-hidden />
                  {strings.settings.clearAll}
                </Button>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
