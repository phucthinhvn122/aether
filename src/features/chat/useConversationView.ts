import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef } from 'react';
import { db, getConversationMessages } from '../../lib/db';
import type { Message } from '../../lib/types';
import { artifactStore, closeArtifact, openArtifact } from '../artifacts/artifactStore';
import { parseSegmentsCached } from '../artifacts/parse';
import { useArtifactIndex } from '../artifacts/useArtifacts';
import { streamStore } from './streamStore';

const NO_MESSAGES: Message[] = [];

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

  const messages = useMemo(() => {
    const list = stored ?? NO_MESSAGES;
    if (!liveHere) return list;
    return list.map((m) => (m.id === stream.messageId ? { ...m, content: stream.content, thinking: stream.thinking || undefined } : m));
  }, [stored, liveHere, stream.messageId, stream.content, stream.thinking]);

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
