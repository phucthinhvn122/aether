import { db, getConversationMessages, getSettings } from '../../lib/db';
import { completeChat } from '../../lib/openai';
import { strings } from '../../lib/strings';
import { splitInlineThinking } from './thinkTags';

const TITLE_PROMPT =
  'Write a short title (at most 6 words) summarizing this conversation. Use the same language as the user. Reply with the title only — no quotes, no trailing punctuation, no markdown.';

export function cleanTitle(raw: string): string {
  const { content } = splitInlineThinking(raw);
  const line = content
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean);
  if (!line) return '';
  const cleaned = line
    .replace(/^(title|tiêu đề)\s*[:：]\s*/i, '')
    .replace(/[*_#`]/g, '')
    .replace(/^["'“”‘’«»「」]+|["'“”‘’«»「」]+$/g, '')
    .replace(/[.。!！?？,:;]+$/, '')
    .trim();
  const words = cleaned.split(/\s+/);
  return (words.length > 6 ? words.slice(0, 6).join(' ') : cleaned).slice(0, 80);
}

function fallbackTitle(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine ? oneLine.split(' ').slice(0, 6).join(' ').slice(0, 60) : strings.chat.untitled;
}

/** One non-streaming call after the first turn. Never overwrites a user-chosen title. */
export async function autoTitle(conversationId: string): Promise<void> {
  const conversation = await db.conversations.get(conversationId);
  if (!conversation || conversation.autoTitled) return;
  const messages = await getConversationMessages(conversationId);
  const firstUser = messages.find((m) => m.role === 'user');
  const firstAssistant = messages.find((m) => m.role === 'assistant' && m.content.trim());
  if (!firstUser || !firstAssistant) return;

  const userText = firstUser.content || firstUser.attachments?.map((a) => a.name).join(', ') || '';
  let title = '';
  try {
    const settings = await getSettings();
    const raw = await completeChat(settings, {
      model: settings.model,
      messages: [
        { role: 'system', content: TITLE_PROMPT },
        {
          role: 'user',
          content: `User: ${userText.slice(0, 1500)}\n\nAssistant: ${firstAssistant.content.slice(0, 1500)}\n\nTitle:`,
        },
      ],
    });
    title = cleanTitle(raw);
  } catch {
    title = '';
  }

  const latest = await db.conversations.get(conversationId);
  if (!latest || latest.autoTitled || latest.title !== conversation.title) return;
  await db.conversations.update(conversationId, { title: title || fallbackTitle(userText), autoTitled: true });
}
