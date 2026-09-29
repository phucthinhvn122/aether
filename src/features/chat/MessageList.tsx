import type { Message } from '../../lib/types';
import type { ArtifactIndex } from '../artifacts/useArtifacts';
import { AssistantMessage } from './AssistantMessage';
import type { StreamPhase } from './streamStore';
import { UserMessage } from './UserMessage';

interface MessageListProps {
  messages: Message[];
  streamingId: string | null;
  phase: StreamPhase;
  artifacts: ArtifactIndex;
  openArtifactId: string | null;
  onRegenerate: () => void;
  onEdit: (messageId: string, content: string) => void;
}

export function MessageList({ messages, streamingId, phase, artifacts, openArtifactId, onRegenerate, onEdit }: MessageListProps) {
  const busy = streamingId !== null;
  return (
    <ol className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6" aria-busy={busy}>
      {messages.map((m, i) => (
        <li key={m.id}>
          {m.role === 'user' ? (
            <UserMessage message={m} canEdit={!busy} onEdit={(content) => onEdit(m.id, content)} />
          ) : (
            <AssistantMessage
              message={m}
              phase={m.id === streamingId ? phase : null}
              isLast={i === messages.length - 1}
              artifacts={artifacts}
              openArtifactId={openArtifactId}
              onRegenerate={onRegenerate}
            />
          )}
        </li>
      ))}
    </ol>
  );
}
