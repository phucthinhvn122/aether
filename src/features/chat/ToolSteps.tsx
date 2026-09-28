import { ChevronDown, CircleAlert, FileText, Globe, LoaderCircle, Search } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/cn';
import { strings } from '../../lib/strings';
import type { ToolSource, ToolStep } from '../../lib/types';

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function SourceLink({ source }: { source: ToolSource }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer noopener"
      className="flex min-h-9 min-w-0 items-center gap-2 rounded-lg px-2 text-left hover:bg-muted"
    >
      <Globe className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{source.title || source.url}</span>
      <span className="max-w-[40%] shrink-0 truncate text-[11px] text-ink-faint">{hostOf(source.url)}</span>
    </a>
  );
}

function StepRow({ step }: { step: ToolStep }) {
  const Icon = step.status === 'running' ? LoaderCircle : step.status === 'error' ? CircleAlert : step.kind === 'fetch' ? FileText : Search;
  const verb =
    step.kind === 'fetch'
      ? step.status === 'running'
        ? strings.tools.reading
        : strings.tools.read
      : step.status === 'running'
        ? strings.tools.searching
        : strings.tools.searched;
  const label = step.kind === 'fetch' ? hostOf(step.label) : step.label;
  return (
    <li className="flex flex-col gap-0.5">
      <div className="flex min-h-8 items-center gap-2 px-2 text-[13px] text-ink-soft">
        <Icon
          className={cn('size-3.5 shrink-0', step.status === 'running' && 'animate-spin text-accent', step.status === 'error' && 'text-danger')}
          aria-hidden
        />
        <span className="shrink-0">{verb}</span>
        <span className="min-w-0 truncate font-medium text-ink">{label}</span>
      </div>
      {step.error && <p className="px-2 pl-7 text-xs text-danger">{step.error}</p>}
      {step.kind === 'search' && step.sources && step.sources.length > 0 && (
        <div className="flex flex-col pl-5">
          {step.sources.map((s) => (
            <SourceLink key={s.url} source={s} />
          ))}
        </div>
      )}
    </li>
  );
}

export function ToolSteps({ steps, active }: { steps: ToolStep[]; active: boolean }) {
  const [manual, setManual] = useState<boolean | null>(null);
  const open = manual ?? active;
  const running = steps.some((s) => s.status === 'running');
  const sourceCount = new Set(steps.flatMap((s) => s.sources ?? []).map((s) => s.url)).size;

  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-line bg-surface/60 font-sans">
      <button
        type="button"
        onClick={() => setManual(!open)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm text-ink-soft hover:text-ink"
      >
        <Globe className={cn('size-4 shrink-0', running && 'text-accent')} aria-hidden />
        <span className={cn('min-w-0 flex-1 truncate', running && 'animate-shimmer')}>
          {running ? `${strings.tools.searchingWeb}…` : strings.tools.summary(steps.length, sourceCount)}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <ul className="scroll-area flex max-h-80 flex-col gap-1 border-t border-line/70 px-1 py-2">
          {steps.map((s) => (
            <StepRow key={s.id} step={s} />
          ))}
        </ul>
      )}
    </div>
  );
}
