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
  /** Offer web_search / fetch_url tools to the model (tool calling). */
  webSearch: boolean;
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

export interface ToolSource {
  title: string;
  url: string;
}

/** One tool invocation made while answering (web search, page fetch). */
export interface ToolStep {
  id: string;
  kind: 'search' | 'fetch';
  /** The search query or URL. */
  label: string;
  status: 'running' | 'done' | 'error';
  sources?: ToolSource[];
  error?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  thinking?: string;
  steps?: ToolStep[];
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
