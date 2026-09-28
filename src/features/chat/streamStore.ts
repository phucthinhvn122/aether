import { createStore } from '../../lib/store';
import type { ToolStep } from '../../lib/types';

export type StreamPhase = 'idle' | 'waiting' | 'thinking' | 'answering' | 'tools';

export interface StreamState {
  conversationId: string | null;
  messageId: string | null;
  content: string;
  thinking: string;
  steps: ToolStep[];
  phase: StreamPhase;
}

export const IDLE_STREAM: StreamState = {
  conversationId: null,
  messageId: null,
  content: '',
  thinking: '',
  steps: [],
  phase: 'idle',
};

export const streamStore = createStore<StreamState>(IDLE_STREAM);

export function useIsStreaming(conversationId: string | undefined): boolean {
  return streamStore.use((s) => s.phase !== 'idle' && s.conversationId === conversationId);
}
