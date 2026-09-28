import { useMemo } from 'react';
import type { Message } from '../../lib/types';
import { parseSegmentsCached } from './parse';
import type { ArtifactVersion } from './types';

export type ArtifactIndex = Map<string, ArtifactVersion[]>;

/** Groups every artifact in the conversation by id; each regeneration becomes a new version. */
export function collectArtifacts(messages: Pick<Message, 'id' | 'role' | 'content'>[]): ArtifactIndex {
  const index: ArtifactIndex = new Map();
  for (const m of messages) {
    if (m.role !== 'assistant' || !m.content) continue;
    for (const seg of parseSegmentsCached(m.content, m.id)) {
      if (seg.kind !== 'artifact') continue;
      const list = index.get(seg.artifact.id) ?? [];
      list.push({ ...seg.artifact, messageId: m.id });
      index.set(seg.artifact.id, list);
    }
  }
  return index;
}

export function useArtifactIndex(messages: Pick<Message, 'id' | 'role' | 'content'>[]): ArtifactIndex {
  return useMemo(() => collectArtifacts(messages), [messages]);
}

/** Version number (1-based) of the artifact produced by a given message. */
export function versionOf(index: ArtifactIndex, id: string, messageId: string): { version: number; total: number } {
  const list = index.get(id) ?? [];
  const i = list.findIndex((v) => v.messageId === messageId);
  return { version: i + 1, total: list.length };
}
