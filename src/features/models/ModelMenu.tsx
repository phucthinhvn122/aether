import { Check, ChevronDown, LoaderCircle, Plus, RefreshCw, Settings as SettingsIcon } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { saveSettings, selectModel } from '../../lib/db';
import { routeHref } from '../../lib/router';
import { strings } from '../../lib/strings';
import type { ReasoningEffort } from '../../lib/types';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { useSettings } from '../settings/useSettings';
import { splitModelId } from './modelName';
import { useModelList } from './useModelList';

const EFFORTS: ReasoningEffort[] = ['auto', 'low', 'medium', 'high'];
const MAX_LISTED = 150;

function ModelRow({ id, selected, onPick }: { id: string; selected: boolean; onPick: (id: string) => void }) {
  const { name, vendor } = splitModelId(id);
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={() => onPick(id)}
      className={cn(
        'flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-muted lg:min-h-9',
        selected && 'bg-muted/70',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-ink">{name}</span>
        {vendor && <span className="block truncate text-[11px] text-ink-faint">{vendor}</span>}
      </span>
      {selected && <Check className="size-4 shrink-0 text-accent" aria-hidden />}
    </button>
  );
}

function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 pt-2 pb-1">
      <span className="text-[11px] font-medium tracking-wide text-ink-faint uppercase">{children}</span>
      {action}
    </div>
  );
}

/** Claude-style model switcher that lives in the composer toolbar. */
export function ModelMenu() {
  const settings = useSettings();
  const { models, fresh, loading, error, refresh } = useModelList(settings);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const finePointer = useMediaQuery('(pointer: fine)');

  useEffect(() => {
    if (!open) return;
    if (finePointer) inputRef.current?.focus();
    if (!fresh && !loading && !error) void refresh();
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
    // Only react to the menu opening; refresh identity changes with every settings write.
  }, [open]);

  const current = settings?.model ?? '';
  const q = query.trim().toLowerCase();

  const { recent, available, showCustom } = useMemo(() => {
    const recentIds = [current, ...(settings?.recentModels ?? [])].filter((m, i, a) => m && a.indexOf(m) === i);
    const match = (m: string) => !q || m.toLowerCase().includes(q);
    const recentSet = new Set(recentIds);
    const typed = query.trim();
    return {
      recent: recentIds.filter(match),
      available: models.filter((m) => !recentSet.has(m) && match(m)).slice(0, MAX_LISTED),
      showCustom: typed.length > 0 && !recentSet.has(typed) && !models.includes(typed),
    };
  }, [current, settings?.recentModels, models, q, query]);

  if (!settings) return null;

  const pick = (id: string) => {
    void selectModel(id);
    setOpen(false);
    setQuery('');
  };

  const label = current ? splitModelId(current).name : strings.modelMenu.noModel;
  const effort = settings.reasoningEffort;

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        title={strings.modelMenu.button}
        className={cn(
          'inline-flex min-h-11 max-w-[11rem] items-center gap-1 rounded-xl px-2.5 text-sm transition-colors hover:bg-muted sm:max-w-[16rem] lg:min-h-9',
          open ? 'bg-muted text-ink' : 'text-ink-soft',
          !current && 'text-accent',
        )}
      >
        <span className="truncate">{label}</span>
        {effort !== 'auto' && (
          <span className="shrink-0 rounded-md bg-accent-soft px-1.5 text-[11px] font-medium text-accent-strong">
            {strings.modelMenu.efforts[effort]}
          </span>
        )}
        <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-40 mb-2 flex w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-xl animate-fade-in">
          <div className="border-b border-line p-2">
            <label htmlFor={`${listId}-search`} className="sr-only">
              {strings.modelMenu.search}
            </label>
            <input
              id={`${listId}-search`}
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && query.trim()) {
                  e.preventDefault();
                  pick(recent[0] ?? available[0] ?? query.trim());
                }
              }}
              placeholder={strings.modelMenu.search}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="h-11 w-full rounded-lg bg-muted/60 px-3 text-sm text-ink placeholder:text-ink-faint outline-none focus:bg-muted lg:h-9"
            />
          </div>

          <div id={listId} role="listbox" aria-label={strings.modelMenu.button} className="scroll-area max-h-[min(22rem,45vh)] p-1">
            {showCustom && (
              <button
                type="button"
                onClick={() => pick(query.trim())}
                className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-accent-strong hover:bg-accent-soft lg:min-h-9"
              >
                <Plus className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{strings.modelMenu.useCustom(query.trim())}</span>
              </button>
            )}

            {recent.length > 0 && (
              <>
                <SectionLabel>{strings.modelMenu.recent}</SectionLabel>
                {recent.map((m) => (
                  <ModelRow key={`r-${m}`} id={m} selected={m === current} onPick={pick} />
                ))}
              </>
            )}

            <SectionLabel
              action={
                <button
                  type="button"
                  onClick={() => void refresh()}
                  disabled={loading}
                  aria-label={strings.modelMenu.refresh}
                  title={strings.modelMenu.refresh}
                  className="inline-flex size-8 items-center justify-center rounded-md text-ink-faint hover:bg-muted hover:text-ink"
                >
                  {loading ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> : <RefreshCw className="size-3.5" aria-hidden />}
                </button>
              }
            >
              {strings.modelMenu.available}
            </SectionLabel>
            {loading && models.length === 0 && <p className="px-3 py-2 text-sm text-ink-faint">{strings.modelMenu.loading}</p>}
            {error && <p className="mx-2 my-1 line-clamp-4 rounded-lg bg-danger-soft p-2 text-xs whitespace-pre-wrap text-danger">{error}</p>}
            {!loading && !error && available.length === 0 && recent.length === 0 && (
              <p className="px-3 py-2 text-sm text-ink-faint">{strings.modelMenu.empty}</p>
            )}
            {available.map((m) => (
              <ModelRow key={m} id={m} selected={m === current} onPick={pick} />
            ))}
          </div>

          <div className="border-t border-line p-2">
            <div className="flex items-center gap-2 px-1">
              <span className="shrink-0 text-xs text-ink-faint">{strings.modelMenu.effort}</span>
              <div role="radiogroup" aria-label={strings.settings.thinkingEffort} className="flex flex-1 rounded-lg bg-muted/70 p-0.5">
                {EFFORTS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    role="radio"
                    aria-checked={effort === e}
                    onClick={() => void saveSettings({ reasoningEffort: e })}
                    className={cn(
                      'min-h-9 flex-1 rounded-md px-1 text-xs transition-colors lg:min-h-7',
                      effort === e ? 'bg-surface font-medium text-ink shadow-sm' : 'text-ink-faint hover:text-ink',
                    )}
                  >
                    {strings.modelMenu.efforts[e]}
                  </button>
                ))}
              </div>
            </div>
            <a
              href={routeHref({ name: 'settings' })}
              className="mt-1 flex min-h-11 items-center gap-2 rounded-lg px-2 text-xs text-ink-faint hover:bg-muted hover:text-ink lg:min-h-8"
            >
              <SettingsIcon className="size-3.5" aria-hidden />
              {strings.modelMenu.manage}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
