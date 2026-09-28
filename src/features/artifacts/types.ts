export type ArtifactType = 'html' | 'markdown' | 'code' | 'slides';

/** Downloadable file format the user asked for (PDF document, PowerPoint deck). */
export type ExportFormat = 'pdf' | 'pptx';

export interface ArtifactBlock {
  id: string;
  title: string;
  type: ArtifactType;
  language?: string;
  /** Requested export format, from `format="pdf"` on the directive (slides always offer pptx + pdf). */
  format?: ExportFormat;
  content: string;
  /** False while the closing marker has not streamed in yet. */
  complete: boolean;
}

export type Segment = { kind: 'text'; text: string } | { kind: 'artifact'; artifact: ArtifactBlock };

export interface ArtifactVersion extends ArtifactBlock {
  messageId: string;
}
