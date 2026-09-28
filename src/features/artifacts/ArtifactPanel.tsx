import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { useEffect } from 'react';
import { CopyButton } from '../../components/CopyButton';
import { IconButton } from '../../components/IconButton';
import { cn } from '../../lib/cn';
import { downloadText, safeFilename } from '../../lib/download';
import { strings } from '../../lib/strings';
import { ArtifactPreview } from './ArtifactPreview';
import { artifactStore, closeArtifact, setArtifactTab, setArtifactVersion, type ArtifactTab } from './artifactStore';
import { artifactExtension } from './parse';
import type { ArtifactIndex } from './useArtifacts';

const MIME = { html: 'text/html', markdown: 'text/markdown', code: 'text/plain' } as const;

interface ArtifactPanelProps {
  index: ArtifactIndex;
  /** Rendered as a full-screen sheet on mobile. */
  sheet: boolean;
}

export function ArtifactPanel({ index, sheet }: ArtifactPanelProps) {
  const openId = artifactStore.use((s) => s.openId);
  const versionIndex = artifactStore.use((s) => s.versionIndex);
  const tab = artifactStore.use((s) => s.tab);

  const versions = openId ? index.get(openId) : undefined;

  useEffect(() => {
    if (!sheet || !versions) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeArtifact();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheet, versions]);

  if (!versions || versions.length === 0) return null;
  const current = Math.min(versionIndex ?? versions.length - 1, versions.length - 1);
  const artifact = versions[current];
  const tabs: ArtifactTab[] = artifact.type === 'code' ? ['code'] : ['preview', 'code'];
  const activeTab = tabs.includes(tab) ? tab : tabs[0];
  const goTo = (i: number) => setArtifactVersion(i >= versions.length - 1 ? null : i);

  return (
    <aside
      aria-label={artifact.title}
      className={cn(
        'flex min-h-0 flex-col bg-surface',
        sheet ? 'app-root z-50 animate-sheet-in' : 'h-full border-l border-line',
      )}
    >
      <header className={cn('shrink-0 border-b border-line', sheet && 'pt-safe')}>
        <div className="flex h-14 items-center gap-1 pl-4 pr-2">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-ink">{artifact.title}</h2>
            {versions.length > 1 && (
              <p className="text-xs text-ink-faint">{strings.artifacts.version(current + 1, versions.length)}</p>
            )}
          </div>
          {versions.length > 1 && (
            <>
              <IconButton label={strings.artifacts.previousVersion} size="sm" disabled={current === 0} onClick={() => goTo(current - 1)}>
                <ChevronLeft className="size-4" aria-hidden />
              </IconButton>
              <IconButton
                label={strings.artifacts.nextVersion}
                size="sm"
                disabled={current === versions.length - 1}
                onClick={() => goTo(current + 1)}
              >
                <ChevronRight className="size-4" aria-hidden />
              </IconButton>
            </>
          )}
          <CopyButton text={artifact.content} />
          <IconButton
            label={strings.common.download}
            size="sm"
            onClick={() =>
              downloadText(`${safeFilename(artifact.title)}.${artifactExtension(artifact)}`, artifact.content, MIME[artifact.type])
            }
          >
            <Download className="size-4" aria-hidden />
          </IconButton>
          <IconButton label={strings.artifacts.close} size="sm" onClick={closeArtifact}>
            <X className="size-4" aria-hidden />
          </IconButton>
        </div>
        {tabs.length > 1 && (
          <div role="tablist" className="flex gap-1 px-3 pb-2">
            {tabs.map((t) => (
              <button
                key={t}
                role="tab"
                type="button"
                aria-selected={activeTab === t}
                onClick={() => setArtifactTab(t)}
                className={cn(
                  'min-h-11 rounded-lg px-3 text-sm font-medium transition-colors lg:min-h-8',
                  activeTab === t ? 'bg-muted text-ink' : 'text-ink-faint hover:text-ink',
                )}
              >
                {t === 'preview' ? strings.artifacts.preview : strings.artifacts.code}
              </button>
            ))}
          </div>
        )}
      </header>
      <div className={cn('min-h-0 flex-1', activeTab === 'preview' && artifact.type === 'html' && artifact.complete ? 'overflow-hidden' : 'scroll-area', sheet && 'pb-safe')}>
        <ArtifactPreview artifact={artifact} tab={activeTab} />
      </div>
    </aside>
  );
}
