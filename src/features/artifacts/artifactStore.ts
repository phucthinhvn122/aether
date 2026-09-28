import { createStore } from '../../lib/store';

export type ArtifactTab = 'preview' | 'code';

interface ArtifactUiState {
  conversationId: string | null;
  openId: string | null;
  /** Index into the artifact's versions; null follows the latest version. */
  versionIndex: number | null;
  tab: ArtifactTab;
}

export const artifactStore = createStore<ArtifactUiState>({
  conversationId: null,
  openId: null,
  versionIndex: null,
  tab: 'preview',
});

export function openArtifact(conversationId: string, id: string, versionIndex: number | null = null) {
  artifactStore.set({ conversationId, openId: id, versionIndex, tab: 'preview' });
}

export function closeArtifact() {
  artifactStore.set({ openId: null, versionIndex: null });
}

export function setArtifactVersion(versionIndex: number | null) {
  artifactStore.set({ versionIndex });
}

export function setArtifactTab(tab: ArtifactTab) {
  artifactStore.set({ tab });
}
