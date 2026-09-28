import { db } from '../../lib/db';

export async function renameConversation(id: string, title: string): Promise<void> {
  const clean = title.trim();
  if (!clean) return;
  await db.conversations.update(id, { title: clean.slice(0, 120), autoTitled: true });
}

export async function togglePin(id: string, pinned: boolean): Promise<void> {
  await db.conversations.update(id, { pinned });
}

export async function deleteConversation(id: string): Promise<void> {
  await db.transaction('rw', db.conversations, db.messages, async () => {
    await db.messages.where('conversationId').equals(id).delete();
    await db.conversations.delete(id);
  });
}
