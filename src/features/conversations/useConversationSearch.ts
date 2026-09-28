import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../../lib/db';
import type { Conversation } from '../../lib/types';

export interface ConversationHit {
  conversation: Conversation;
  snippet?: string;
}

function snippetAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 30);
  const end = Math.min(text.length, index + length + 50);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${end < text.length ? '…' : ''}`;
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** Conversations sorted by updatedAt; filtered by title and message text when a query is set. */
export function useConversationSearch(query: string): ConversationHit[] | undefined {
  const q = useDebounced(query.trim().toLowerCase(), 180);
  return useLiveQuery(async () => {
    const conversations = await db.conversations.orderBy('updatedAt').reverse().toArray();
    if (!q) return conversations.map((conversation) => ({ conversation }));

    const snippets = new Map<string, string>();
    await db.messages.each((m) => {
      if (snippets.has(m.conversationId) || m.role === 'system') return;
      const i = m.content.toLowerCase().indexOf(q);
      if (i >= 0) snippets.set(m.conversationId, snippetAround(m.content, i, q.length));
    });
    return conversations
      .filter((c) => c.title.toLowerCase().includes(q) || snippets.has(c.id))
      .map((conversation) => ({
        conversation,
        snippet: conversation.title.toLowerCase().includes(q) ? undefined : snippets.get(conversation.id),
      }));
  }, [q]);
}
