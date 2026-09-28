import { RotateCcw } from 'lucide-react';
import { memo, useMemo } from 'react';
import { CopyButton } from '../../components/CopyButton';
import { IconButton } from '../../components/IconButton';
import { cn } from '../../lib/cn';
import { strings } from '../../lib/strings';
import type { Message } from '../../lib/types';
import { ArtifactCard } from '../artifacts/ArtifactCard';
import { artifactStore, openArtifact } from '../artifacts/artifactStore';
import { parseSegmentsCached } from '../artifacts/parse';
import { versionOf, type ArtifactIndex } from '../artifacts/useArtifacts';
import { Markdown } from '../markdown/Markdown';
import { ErrorNotice } from './ErrorNotice';
import type { StreamPhase } from './streamStore';
import { ThinkingBlock } from './ThinkingBlock';
import { ToolSteps } from './ToolSteps';

interface AssistantMessageProps {
  message: Message;
  phase: StreamPhase | null;
  isLast: boolean;
  artifacts: ArtifactIndex;
  openArtifactId: string | null;
  onRegenerate: () => void;
}

function TypingDots() {
  return (
    <div className="flex h-7 items-center gap-1.5" role="status" aria-label={strings.chat.thinking}>
      {[0, 150, 300].map((delay) => (
        <span key={delay} className="size-2 animate-shimmer rounded-full bg-accent" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </div>
  );
}

export const AssistantMessage = memo(function AssistantMessage({
  message,
  phase,
  isLast,
  artifacts,
  openArtifactId,
  onRegenerate,
}: AssistantMessageProps) {
  const streaming = phase !== null;
  const segments = useMemo(() => parseSegmentsCached(message.content, message.id), [message.content, message.id]);
  const openVersionIndex = artifactStore.use((s) => s.versionIndex);

  return (
    <div className="group flex flex-col">
      {message.thinking && <ThinkingBlock text={message.thinking} active={phase === 'thinking'} />}
      {message.steps && message.steps.length > 0 && <ToolSteps steps={message.steps} active={phase === 'tools'} />}
      {streaming && !message.content && !message.thinking && !message.steps?.length && <TypingDots />}

      {segments.map((seg, i) => {
        const last = i === segments.length - 1;
        if (seg.kind === 'text') {
          return <Markdown key={i} content={seg.text} streaming={streaming && last && phase === 'answering'} />;
        }
        const { version, total } = versionOf(artifacts, seg.artifact.id, message.id);
        return (
          <ArtifactCard
            key={`${seg.artifact.id}-${i}`}
            artifact={seg.artifact}
            version={version}
            total={total}
            active={openArtifactId === seg.artifact.id && (openVersionIndex ?? total - 1) === version - 1}
            onOpen={() => openArtifact(message.conversationId, seg.artifact.id, version === total ? null : version - 1)}
          />
        );
      })}

      {message.error && <ErrorNotice message={message.error} onRetry={isLast && !streaming ? onRegenerate : undefined} />}

      {!streaming && message.content && (
        <div
          className={cn(
            'mt-1 -ml-2 flex items-center gap-0.5 transition-opacity',
            !isLast && 'pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-within:opacity-100',
          )}
        >
          <CopyButton text={message.content} label={strings.chat.copyMessage} />
          {isLast && (
            <IconButton label={strings.chat.regenerate} size="sm" onClick={onRegenerate}>
              <RotateCcw className="size-4" aria-hidden />
            </IconButton>
          )}
          {message.model && <span className="ml-2 truncate font-mono text-[11px] text-ink-faint">{message.model}</span>}
        </div>
      )}
    </div>
  );
});
