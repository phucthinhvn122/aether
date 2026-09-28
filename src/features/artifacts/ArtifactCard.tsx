import { ChevronRight, Code, FileText, Globe, LoaderCircle, Presentation } from 'lucide-react';
import { cn } from '../../lib/cn';
import { strings } from '../../lib/strings';
import { splitSlides } from './slides';
import type { ArtifactBlock } from './types';
import { exportLabel, useExport, type ExportKind } from './useExport';

const ICONS = { html: Globe, markdown: FileText, code: Code, slides: Presentation } as const;

interface ArtifactCardProps {
  artifact: ArtifactBlock;
  version: number;
  total: number;
  active: boolean;
  onOpen: () => void;
}

/** Download buttons shown right under the card when the user asked for a file (PDF / PowerPoint). */
function QuickExports({ artifact }: { artifact: ArtifactBlock }) {
  const { busy, error, run } = useExport();
  const kinds: ExportKind[] = artifact.type === 'slides' ? ['pptx', 'pdf'] : artifact.format ? [artifact.format] : [];
  if (kinds.length === 0) return null;
  return (
    <div className="-mt-1 mb-3 flex max-w-md flex-col gap-1.5 font-sans">
      <div className="flex flex-wrap gap-2">
        {kinds.map((kind) => (
          <button
            key={kind}
            type="button"
            disabled={busy !== null}
            onClick={() => void run(kind, artifact)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-60 lg:min-h-9"
          >
            {busy === kind ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : kind === 'pptx' ? <Presentation className="size-4" aria-hidden /> : <FileText className="size-4" aria-hidden />}
            {busy === kind ? strings.artifacts.exporting : exportLabel(kind, artifact)}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function ArtifactCard({ artifact, version, total, active, onOpen }: ArtifactCardProps) {
  const Icon = ICONS[artifact.type];
  const size =
    artifact.type === 'slides'
      ? strings.artifacts.slideCount(splitSlides(artifact.content).length)
      : strings.artifacts.lineCount(artifact.content ? artifact.content.split('\n').length : 0);
  return (
    <>
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
              ? `${strings.artifacts.typeLabel[artifact.type]}${artifact.language ? ` · ${artifact.language}` : ''} · ${size}${total > 1 ? ` · ${strings.artifacts.version(version, total)}` : ''}`
              : strings.artifacts.generating}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
      </button>
      {artifact.complete && <QuickExports artifact={artifact} />}
    </>
  );
}
