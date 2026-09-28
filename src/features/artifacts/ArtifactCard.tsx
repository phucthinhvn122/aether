import { ChevronRight, Code, FileText, Globe, LoaderCircle } from 'lucide-react';
import { cn } from '../../lib/cn';
import { strings } from '../../lib/strings';
import type { ArtifactBlock } from './types';

const ICONS = { html: Globe, markdown: FileText, code: Code } as const;

interface ArtifactCardProps {
  artifact: ArtifactBlock;
  version: number;
  total: number;
  active: boolean;
  onOpen: () => void;
}

export function ArtifactCard({ artifact, version, total, active, onOpen }: ArtifactCardProps) {
  const Icon = ICONS[artifact.type];
  const lines = artifact.content ? artifact.content.split('\n').length : 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${strings.artifacts.open}: ${artifact.title}`}
      className={cn(
        'group my-3 flex w-full max-w-md items-center gap-3 rounded-2xl border bg-surface p-3 text-left font-sans transition-colors',
        active ? 'border-accent/60 ring-2 ring-accent/15' : 'border-line hover:border-ink-faint/50',
      )}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-bg">
        {artifact.complete ? (
          <Icon className="size-5 text-ink-soft" aria-hidden />
        ) : (
          <LoaderCircle className="size-5 animate-spin text-accent" aria-hidden />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{artifact.title}</span>
        <span className="block truncate text-xs text-ink-faint">
          {artifact.complete
            ? `${strings.artifacts.typeLabel[artifact.type]}${artifact.language ? ` · ${artifact.language}` : ''} · ${lines} lines${total > 1 ? ` · ${strings.artifacts.version(version, total)}` : ''}`
            : strings.artifacts.generating}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
    </button>
  );
}
