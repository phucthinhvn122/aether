import { Check, ChevronDown, Globe, LoaderCircle, Plus, RefreshCw, Settings as SettingsIcon } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
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
const POPOVER_WIDTH = 352;
const EDGE = 8;

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

/** Fixed-position style that keeps the popover inside the viewport, opening above the anchor when there is room. */
function usePopoverStyle(anchorRef: RefObject<HTMLElement | null>, active: boolean): CSSProperties | null {
  const [style, setStyle] = useState<CSSProperties | null>(null);
  useLayoutEffect(() => {
    if (!active) return;
    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const vw = window.innerWidth;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      const width = Math.min(POPOVER_WIDTH, vw - EDGE * 2);
      const left = Math.min(Math.max(rect.left, EDGE), vw - width - EDGE);
      const above = rect.top - EDGE * 2;
      const below = vh - rect.bottom - EDGE * 2;
      setStyle(
        above >= Math.min(460, below)
          ? { left, width, bottom: vh - rect.top + EDGE, maxHeight: above }
          : { left, width, top: rect.bottom + EDGE, maxHeight: below },
      );
    };
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, [active, anchorRef]);
  return style;
}

/** Claude-style model switcher that lives in the composer toolbar. */
export function ModelMenu() {
  const settings = useSettings();
  const { models, fresh, loading, error, refresh } = useModelList(settings);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const finePointer = useMediaQuery('(pointer: fine)');
  const sheet = !useMediaQuery('(min-width: 640px)');
  const popoverStyle = usePopoverStyle(rootRef, open && !sheet);

  useEffect(() => {
    if (!open) return;
    if (finePointer) inputRef.current?.focus();
    if (!fresh && !loading && !error) void refresh();
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
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

  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const pick = (id: string) => {
    void selectModel(id);
    close();
  };

  const label = current ? splitModelId(current).name : strings.modelMenu.noModel;
  const effort = settings.reasoningEffort;

  const content = (
    <>
      <div className="shrink-0 border-b border-line p-2">
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
          enterKeyHint="go"
          className="h-11 w-full rounded-lg bg-muted/60 px-3 text-ink placeholder:text-ink-faint outline-none focus:bg-muted lg:h-9 lg:text-sm"
        />
      </div>

      <div id={listId} role="listbox" aria-label={strings.modelMenu.button} className="scroll-area min-h-24 flex-1 p-1">
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

      <div className="flex shrink-0 flex-col gap-1 border-t border-line p-2">
        <div className="flex flex-col gap-1.5 px-1 pt-1">
          <span className="text-xs text-ink-faint">{strings.modelMenu.effort}</span>
          <div role="radiogroup" aria-label={strings.settings.thinkingEffort} className="grid grid-cols-4 gap-0.5 rounded-lg bg-muted/70 p-0.5">
            {EFFORTS.map((e) => (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={effort === e}
                onClick={() => void saveSettings({ reasoningEffort: e })}
                className={cn(
                  'min-h-10 min-w-0 truncate rounded-md px-1 text-xs transition-colors lg:min-h-7',
                  effort === e ? 'bg-surface font-medium text-ink shadow-sm' : 'text-ink-faint hover:text-ink',
                )}
              >
                {strings.modelMenu.efforts[e]}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.webSearch}
          onClick={() => void saveSettings({ webSearch: !settings.webSearch })}
          className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-left text-sm text-ink hover:bg-muted lg:min-h-9"
        >
          <Globe className={cn('size-4 shrink-0', settings.webSearch ? 'text-accent' : 'text-ink-faint')} aria-hidden />
          <span className="min-w-0 flex-1 truncate">{strings.modelMenu.webSearch}</span>
          <span className={cn('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors', settings.webSearch ? 'bg-accent' : 'bg-line')}>
            <span className={cn('inline-block size-4 rounded-full bg-white shadow transition-transform', settings.webSearch ? 'translate-x-4.5' : 'translate-x-0.5')} />
          </span>
        </button>
        <a
          href={routeHref({ name: 'settings' })}
          onClick={close}
          className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-xs text-ink-faint hover:bg-muted hover:text-ink lg:min-h-8"
        >
          <SettingsIcon className="size-3.5" aria-hidden />
          {strings.modelMenu.manage}
        </a>
      </div>
    </>
  );

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
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
        {settings.webSearch && <Globe className="size-3.5 shrink-0 text-accent" aria-label={strings.modelMenu.webSearch} />}
        <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open &&
        sheet &&
        createPortal(
          <div className="app-root z-50" role="dialog" aria-modal="true" aria-label={strings.modelMenu.button}>
            <button type="button" aria-label={strings.common.close} onClick={close} className="absolute inset-0 bg-black/30 animate-fade-in" />
            <div
              ref={panelRef}
              className="pb-safe absolute inset-x-0 bottom-0 flex max-h-[85%] flex-col overflow-hidden rounded-t-3xl border-t border-line bg-surface shadow-2xl animate-sheet-in"
            >
              <div className="flex shrink-0 justify-center pt-2 pb-1" aria-hidden>
                <span className="h-1 w-10 rounded-full bg-line" />
              </div>
              {content}
            </div>
          </div>,
          document.body,
        )}

      {open &&
        !sheet &&
        popoverStyle &&
        createPortal(
          <div
            ref={panelRef}
            style={popoverStyle}
            className="fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-xl animate-fade-in"
          >
            {content}
          </div>,
          document.body,
        )}
    </div>
  );
}
