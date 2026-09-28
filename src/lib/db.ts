import Dexie, { type EntityTable } from 'dexie';
import type { Conversation, Message, Project, ProjectFile, Settings } from './types';

export const db = new Dexie('aether') as Dexie & {
  settings: EntityTable<Settings, 'id'>;
  conversations: EntityTable<Conversation, 'id'>;
  messages: EntityTable<Message, 'id'>;
  projects: EntityTable<Project, 'id'>;
  projectFiles: EntityTable<ProjectFile, 'id'>;
};

db.version(1).stores({
  settings: 'id',
  conversations: 'id, updatedAt, projectId',
  messages: 'id, conversationId, createdAt, [conversationId+createdAt]',
  projects: 'id, createdAt',
  projectFiles: 'id, projectId, createdAt',
});

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  baseUrl: '',
  apiKey: '',
  model: '',
  instructions: '',
  useProxy: false,
  vision: true,
  recentModels: [],
  modelCache: [],
  modelCacheBaseUrl: '',
  reasoningEffort: 'auto',
};

const MAX_RECENT_MODELS = 6;

/** Switches the active model and moves it to the front of the recents list. */
export async function selectModel(model: string): Promise<void> {
  const id = model.trim();
  if (!id) return;
  const current = await getSettings();
  const recentModels = [id, ...current.recentModels.filter((m) => m !== id)].slice(0, MAX_RECENT_MODELS);
  await saveSettings({ model: id, recentModels });
}

export async function getSettings(): Promise<Settings> {
  const stored = await db.settings.get('main');
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, ...patch, id: 'main' });
}

export function getConversationMessages(conversationId: string): Promise<Message[]> {
  return db.messages
    .where('[conversationId+createdAt]')
    .between([conversationId, Dexie.minKey], [conversationId, Dexie.maxKey])
    .toArray();
}
