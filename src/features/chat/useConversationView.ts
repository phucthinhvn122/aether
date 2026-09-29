import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef } from 'react';
import { db, getConversationMessages } from '../../lib/db';
import type { Message, ToolStep } from '../../lib/types';
import { artifactStore, closeArtifact, openArtifact } from '../artifacts/artifactStore';
import { parseSegmentsCached } from '../artifacts/parse';
import { useArtifactIndex } from '../artifacts/useArtifacts';
import { streamStore } from './streamStore';

const NO_MESSAGES: Message[] = [];

function sameSteps(a?: ToolStep[], b?: ToolStep[]): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return !a?.length && !b?.length;
  return a.every((s, i) => s.id === b[i].id && s.status === b[i].status && (s.sources?.length ?? 0) === (b[i].sources?.length ?? 0));
}

/** Loads a conversation and overlays the in-flight streamed tokens on top of the stored messages. */
export function useConversationView(conversationId: string | undefined) {
  const conversation = useLiveQuery(
    () => (conversationId ? db.conversations.get(conversationId).then((c) => c ?? null) : null),
    [conversationId],
  );
  const stored = useLiveQuery(
    () => (conversationId ? getConversationMessages(conversationId) : NO_MESSAGES),
    [conversationId],
  );
  const stream = streamStore.use((s) => s);
  const project = useLiveQuery(
    () => (conversation?.projectId ? db.projects.get(conversation.projectId).then((p) => p ?? null) : null),
    [conversation?.projectId],
  );

  const liveHere = stream.conversationId === conversationId && stream.messageId !== null;
  const shown = useRef<Message[]>(NO_MESSAGES);

  const messages = useMemo(() => {
    const list = stored ?? NO_MESSAGES;
    const prev = new Map(shown.current.map((m) => [m.id, m]));
    const next = list.map((m) => {
      const overlay = liveHere && m.id === stream.messageId;
      const content = overlay ? stream.content : m.content;
      const thinking = overlay ? stream.thinking || undefined : m.thinking;
      const steps = overlay && stream.steps.length ? stream.steps : m.steps;
      const old = prev.get(m.id);
      // Dexie hands out fresh objects on every write. Reusing the previous object keeps the
      // rest of the transcript from re-parsing markdown while one message is streaming.
      if (
        old &&
        old.role === m.role &&
        old.content === content &&
        old.thinking === thinking &&
        old.error === m.error &&
        sameSteps(old.steps, steps)
      ) {
        return old;
      }
      return { ...m, content, thinking, steps };
    });
    shown.current = next;
    return next;
  }, [stored, liveHere, stream.messageId, stream.content, stream.thinking, stream.steps]);

  const artifacts = useArtifactIndex(messages);

  useEffect(() => {
    if (artifactStore.get().conversationId !== conversationId) closeArtifact();
  }, [conversationId]);

  const autoOpened = useRef(new Set<string>());
  useEffect(() => {
    if (!liveHere || !conversationId || !stream.messageId) return;
    const segments = parseSegmentsCached(stream.content, stream.messageId);
    const last = [...segments].reverse().find((s) => s.kind === 'artifact');
    if (!last || last.kind !== 'artifact') return;
    const key = `${stream.messageId}:${last.artifact.id}`;
    if (autoOpened.current.has(key)) return;
    autoOpened.current.add(key);
    openArtifact(conversationId, last.artifact.id);
  }, [liveHere, conversationId, stream.messageId, stream.content]);

  return {
    conversation,
    project,
    messages,
    loading: conversationId !== undefined && stored === undefined,
    artifacts,
    streamingId: liveHere ? stream.messageId : null,
    phase: liveHere ? stream.phase : ('idle' as const),
  };
}
