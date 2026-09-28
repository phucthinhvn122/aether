import { db, getConversationMessages, getSettings } from '../../lib/db';
import { uid } from '../../lib/id';
import { ApiError, reasoningParams, streamChat, type ChatMessage } from '../../lib/openai';
import { strings } from '../../lib/strings';
import type { Attachment, Message } from '../../lib/types';
import { autoTitle } from './autoTitle';
import { buildSystemPrompt, hasImageParts, projectImages, toApiMessages } from './buildPrompt';
import { IDLE_STREAM, streamStore } from './streamStore';
import { splitInlineThinking } from './thinkTags';

let activeController: AbortController | null = null;

const PERSIST_EVERY_MS = 1000;
const IMAGE_REJECTION_KINDS = new Set(['badRequest', 'model', 'server']);

export function stopGeneration(): void {
  activeController?.abort();
}

interface SendInput {
  conversationId?: string;
  projectId?: string;
  text: string;
  attachments: Attachment[];
}

/** Adds the user message (creating the conversation if needed) and starts streaming. Returns the conversation id. */
export async function sendMessage({ conversationId, projectId, text, attachments }: SendInput): Promise<string> {
  const now = Date.now();
  let id = conversationId;
  if (!id) {
    id = uid();
    await db.conversations.add({ id, title: strings.chat.untitled, projectId, createdAt: now, updatedAt: now });
  }
  await db.messages.add({
    id: uid(),
    conversationId: id,
    role: 'user',
    content: text,
    attachments: attachments.length ? attachments : undefined,
    createdAt: now,
  });
  await db.conversations.update(id, { updatedAt: now });
  void runAssistant(id);
  return id;
}

/** Deletes everything after the last user message and asks again. */
export async function regenerate(conversationId: string): Promise<void> {
  const messages = await getConversationMessages(conversationId);
  const lastUser = messages.map((m) => m.role).lastIndexOf('user');
  if (lastUser < 0) return;
  const stale = messages.slice(lastUser + 1).map((m) => m.id);
  await db.messages.bulkDelete(stale);
  await runAssistant(conversationId);
}

/** Edits a user message, truncates history after it, and resends. */
export async function editAndResend(messageId: string, content: string): Promise<void> {
  const message = await db.messages.get(messageId);
  if (!message || message.role !== 'user') return;
  const messages = await getConversationMessages(message.conversationId);
  const later = messages.filter((m) => m.createdAt > message.createdAt);
  await db.transaction('rw', db.messages, async () => {
    await db.messages.update(messageId, { content });
    await db.messages.bulkDelete(later.map((m) => m.id));
  });
  await runAssistant(message.conversationId);
}

async function buildRequest(conversationId: string, history: Message[]) {
  const settings = await getSettings();
  const conversation = await db.conversations.get(conversationId);
  const project = conversation?.projectId ? await db.projects.get(conversation.projectId) : undefined;
  const files = project ? await db.projectFiles.where('projectId').equals(project.id).toArray() : [];
  const query = [...history].reverse().find((m) => m.role === 'user')?.content ?? '';
  const system = buildSystemPrompt({ settings, project, files, query });
  const images = settings.vision ? projectImages(files, query) : [];
  const withVision = toApiMessages({ system, history, vision: settings.vision, projectImages: images });
  const textOnly = () => toApiMessages({ system, history, vision: false });
  return { settings, conversation, messages: withVision, textOnly };
}

export async function runAssistant(conversationId: string): Promise<void> {
  activeController?.abort();
  const controller = new AbortController();
  activeController = controller;

  const history = await getConversationMessages(conversationId);
  const { settings, conversation, messages, textOnly } = await buildRequest(conversationId, history);

  const assistantId = uid();
  const lastAt = history[history.length - 1]?.createdAt ?? 0;
  await db.messages.add({
    id: assistantId,
    conversationId,
    role: 'assistant',
    content: '',
    model: settings.model,
    createdAt: Math.max(Date.now(), lastAt + 1),
  });
  streamStore.set({ ...IDLE_STREAM, conversationId, messageId: assistantId, phase: 'waiting' });

  let raw = '';
  let reasoning = '';
  let frame = 0;
  let lastPersist = Date.now();

  const derived = () => {
    const inline = splitInlineThinking(raw);
    return { content: inline.content, thinking: [reasoning, inline.thinking].filter(Boolean).join('\n\n') };
  };
  const flush = () => {
    frame = 0;
    if (activeController !== controller) return;
    const d = derived();
    streamStore.set({ content: d.content, thinking: d.thinking, phase: d.content ? 'answering' : d.thinking ? 'thinking' : 'waiting' });
  };

  const consume = async (payload: ChatMessage[]) => {
    const request = {
      model: settings.model,
      messages: payload,
      signal: controller.signal,
      extraBody: reasoningParams(settings.baseUrl, settings.reasoningEffort),
    };
    for await (const event of streamChat(settings, request)) {
      if (event.type === 'content') raw += event.text;
      else reasoning += event.text;
      if (!frame) frame = requestAnimationFrame(flush);
      if (Date.now() - lastPersist > PERSIST_EVERY_MS) {
        lastPersist = Date.now();
        void db.messages.update(assistantId, derived());
      }
    }
  };

  let error: string | undefined;
  try {
    try {
      await consume(messages);
    } catch (err) {
      const rejectedImages =
        err instanceof ApiError && IMAGE_REJECTION_KINDS.has(err.kind) && hasImageParts(messages) && !raw && !reasoning;
      if (!rejectedImages) throw err;
      await consume(textOnly());
    }
  } catch (err) {
    if (err instanceof ApiError && err.kind === 'aborted') {
      error = raw || reasoning ? undefined : strings.chat.stopped;
    } else {
      error = err instanceof Error ? err.message : String(err);
    }
  } finally {
    if (frame) cancelAnimationFrame(frame);
  }

  const final = derived();
  if (!error && !final.content && !final.thinking) error = strings.errors.emptyResponse;
  await db.messages.update(assistantId, { ...final, error });
  await db.conversations.update(conversationId, { updatedAt: Date.now() });
  // Let the live query pick up the final text before dropping the in-memory overlay (avoids a stale flash).
  await new Promise((r) => setTimeout(r, 60));

  if (activeController === controller) {
    activeController = null;
    streamStore.set(IDLE_STREAM);
  }

  if (!error && conversation && !conversation.autoTitled) void autoTitle(conversationId);
}
