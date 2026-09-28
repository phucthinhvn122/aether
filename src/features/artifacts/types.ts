export type ArtifactType = 'html' | 'markdown' | 'code';

export interface ArtifactBlock {
  id: string;
  title: string;
  type: ArtifactType;
  language?: string;
  content: string;
  /** False while the closing marker has not streamed in yet. */
  complete: boolean;
}

export type Segment = { kind: 'text'; text: string } | { kind: 'artifact'; artifact: ArtifactBlock };

export interface ArtifactVersion extends ArtifactBlock {
  messageId: string;
}
