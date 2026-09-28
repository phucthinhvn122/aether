export type Role = 'user' | 'assistant' | 'system';

export type AttachmentKind = 'image' | 'pdf' | 'text';

export interface Attachment {
  id: string;
  name: string;
  mime: string;
  kind: AttachmentKind;
  size: number;
  /** Data URL for images. */
  dataUrl?: string;
  /** Extracted text for PDFs and text files. */
  textExtract?: string;
}

export interface Settings {
  id: 'main';
  baseUrl: string;
  apiKey: string;
  model: string;
  instructions: string;
  useProxy: boolean;
  /** Send images as image_url parts. Falls back to text automatically if the model rejects them. */
  vision: boolean;
  /** Most recently selected model ids, newest first. */
  recentModels: string[];
  /** Last GET /models result and the base URL it belongs to. */
  modelCache: string[];
  modelCacheBaseUrl: string;
  /** "auto" sends nothing; otherwise sent as reasoning_effort (OpenRouter: reasoning.effort). */
  reasoningEffort: ReasoningEffort;
}

export type ReasoningEffort = 'auto' | 'low' | 'medium' | 'high';

export interface Conversation {
  id: string;
  title: string;
  projectId?: string;
  pinned?: boolean;
  autoTitled?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  thinking?: string;
  attachments?: Attachment[];
  error?: string;
  model?: string;
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  instructions: string;
  createdAt: number;
}

export interface ProjectFile {
  id: string;
  projectId: string;
  name: string;
  mime: string;
  size: number;
  textExtract: string;
  dataUrl?: string;
  createdAt: number;
}
