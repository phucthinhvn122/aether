import { LoaderCircle } from 'lucide-react';
import { useDeferredValue } from 'react';
import { strings } from '../../lib/strings';
import { HighlightedCode } from '../markdown/CodeBlock';
import { Markdown } from '../markdown/Markdown';
import type { ArtifactTab } from './artifactStore';
import type { ArtifactVersion } from './types';

function codeLanguage(a: ArtifactVersion): string | undefined {
  if (a.type === 'html') return 'xml';
  if (a.type === 'markdown') return 'markdown';
  return a.language;
}

export function ArtifactPreview({ artifact, tab }: { artifact: ArtifactVersion; tab: ArtifactTab }) {
  const content = useDeferredValue(artifact.content);
  const showCode = tab === 'code' || artifact.type === 'code' || (artifact.type === 'html' && !artifact.complete);

  if (showCode) {
    return (
      <div className="relative h-full">
        {!artifact.complete && (
          <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-code/95 px-4 py-2 text-xs text-ink-faint">
            <LoaderCircle className="size-3.5 animate-spin text-accent" aria-hidden />
            {strings.artifacts.generating}
          </div>
        )}
        <div className="bg-code min-h-full">
          <HighlightedCode code={content} language={codeLanguage(artifact)} />
        </div>
      </div>
    );
  }

  if (artifact.type === 'html') {
    return (
      <iframe
        title={`${strings.artifacts.iframeTitle}: ${artifact.title}`}
        srcDoc={content}
        sandbox="allow-scripts allow-forms allow-modals allow-popups"
        className="block h-full w-full border-0 bg-white"
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8">
      <Markdown content={content} streaming={!artifact.complete} />
    </div>
  );
}
