import { useState } from 'react';
import { downloadText, safeFilename } from '../../lib/download';
import { strings } from '../../lib/strings';
import { artifactExtension } from './parse';
import type { ArtifactBlock, ArtifactType, ExportFormat } from './types';

export type ExportKind = 'source' | ExportFormat;

const MIME: Record<ArtifactType, string> = { html: 'text/html', markdown: 'text/markdown', code: 'text/plain', slides: 'text/markdown' };

export function exportKinds(artifact: Pick<ArtifactBlock, 'type'>): ExportKind[] {
  if (artifact.type === 'slides') return ['pptx', 'pdf', 'source'];
  if (artifact.type === 'code') return ['source'];
  return ['pdf', 'source'];
}

export function exportLabel(kind: ExportKind, artifact: Pick<ArtifactBlock, 'type' | 'language'>): string {
  if (kind === 'pdf') return strings.artifacts.downloadPdf;
  if (kind === 'pptx') return strings.artifacts.downloadPptx;
  return strings.artifacts.downloadSource(artifactExtension(artifact));
}

/** Runs an export (PDF / PPTX / source file) and tracks its progress and error. */
export function useExport() {
  const [busy, setBusy] = useState<ExportKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: ExportKind, artifact: ArtifactBlock) => {
    if (busy) return;
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'source') {
        await downloadText(`${safeFilename(artifact.title)}.${artifactExtension(artifact)}`, artifact.content, MIME[artifact.type]);
      } else {
        const { exportPdf, exportPptx } = await import('./exporters');
        await (kind === 'pdf' ? exportPdf(artifact) : exportPptx(artifact));
      }
    } catch (err) {
      setError(`${strings.artifacts.exportFailed}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  };

  return { busy, error, run, clearError: () => setError(null) };
}
