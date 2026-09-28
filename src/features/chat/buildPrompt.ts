import type { ChatMessage, ContentPart } from '../../lib/openai';
import type { Message, Project, ProjectFile, Settings } from '../../lib/types';

/** Hidden technical rules. Never rendered in the transcript. */
const TECHNICAL_RULES = `You are Aether, a thoughtful and helpful AI assistant.

Core rules:
- Always reply in the same language the user writes in.
- Format answers with Markdown. Use fenced code blocks with a language tag for code.

Artifacts:
If you create a substantial standalone deliverable (a complete HTML page or app, a long markdown document, or a full code file), wrap it exactly like this:

:::artifact id="unique-kebab-id" title="Short Title" type="html|markdown|code" language="tsx"
...full content...
:::

Artifact rules:
- The opening :::artifact line and the closing ::: must each be on their own line.
- Do NOT wrap the artifact body in code fences.
- type="html" must be one self-contained HTML document (inline CSS and JS; CDN scripts are fine).
- The language attribute is only needed for type="code".
- When the user asks to change an existing artifact, output the complete updated artifact again with the SAME id.
- Keep short snippets, explanations and answers outside artifacts. Add a brief note outside the block describing it.`;

export const KNOWLEDGE_CHAR_CAP = 80_000;
const PER_FILE_CAP = 30_000;
const PER_ATTACHMENT_CAP = 60_000;
const MAX_PROJECT_IMAGES = 3;

function queryTokens(text: string): string[] {
  return Array.from(new Set(text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 3)));
}

function nameScore(name: string, tokens: string[]): number {
  const n = name.toLowerCase();
  return tokens.reduce((score, t) => score + (n.includes(t) ? 1 : 0), 0);
}

/** Files whose names match the latest question first, then most recent. */
export function rankProjectFiles(files: ProjectFile[], query: string): ProjectFile[] {
  const tokens = queryTokens(query);
  return [...files].sort((a, b) => nameScore(b.name, tokens) - nameScore(a.name, tokens) || b.createdAt - a.createdAt);
}

export function buildKnowledge(files: ProjectFile[], query: string, cap = KNOWLEDGE_CHAR_CAP): string {
  if (files.length === 0) return '';
  const ranked = rankProjectFiles(files, query);
  const blocks: string[] = [];
  const omitted: string[] = [];
  let remaining = cap;
  for (const file of ranked) {
    if (!file.textExtract) {
      blocks.push(`<file name="${file.name}" type="${file.mime}">(image file)</file>`);
      continue;
    }
    if (remaining < 500) {
      omitted.push(file.name);
      continue;
    }
    const limit = Math.min(PER_FILE_CAP, remaining);
    const text = file.textExtract.length > limit ? `${file.textExtract.slice(0, limit)}\n[…truncated]` : file.textExtract;
    blocks.push(`<file name="${file.name}">\n${text}\n</file>`);
    remaining -= text.length;
  }
  if (omitted.length) blocks.push(`(Omitted for length: ${omitted.join(', ')})`);
  return blocks.join('\n\n');
}

export function projectImages(files: ProjectFile[], query: string): ProjectFile[] {
  return rankProjectFiles(
    files.filter((f) => f.dataUrl),
    query,
  ).slice(0, MAX_PROJECT_IMAGES);
}

interface SystemPromptInput {
  settings: Settings;
  project?: Project;
  files: ProjectFile[];
  query: string;
}

export function buildSystemPrompt({ settings, project, files, query }: SystemPromptInput): string {
  const sections = [TECHNICAL_RULES, `Current date: ${new Date().toDateString()}.`];
  if (settings.instructions.trim()) {
    sections.push(`User's custom instructions:\n${settings.instructions.trim()}`);
  }
  if (project) {
    sections.push(`The user is working in the project "${project.name}".`);
    if (project.instructions.trim()) {
      sections.push(`Project instructions (take precedence over general instructions):\n${project.instructions.trim()}`);
    }
    const knowledge = buildKnowledge(files, query);
    if (knowledge) {
      sections.push(`Project knowledge files (use them when relevant, cite file names):\n${knowledge}`);
    }
  }
  return sections.join('\n\n');
}

function userContent(message: Message, vision: boolean, extraImages: ProjectFile[] = []): string | ContentPart[] {
  const attachments = message.attachments ?? [];
  const docs = attachments
    .filter((a) => a.kind !== 'image' && a.textExtract)
    .map((a) => {
      const text = a.textExtract!.length > PER_ATTACHMENT_CAP ? `${a.textExtract!.slice(0, PER_ATTACHMENT_CAP)}\n[…truncated]` : a.textExtract!;
      return `<document name="${a.name}">\n${text}\n</document>`;
    });
  const images = attachments.filter((a) => a.kind === 'image' && a.dataUrl);
  const imageNotes = vision ? [] : images.map((a) => `[Image attached: ${a.name} — not visible to this model]`);
  const text = [...docs, ...imageNotes, message.content].filter(Boolean).join('\n\n');

  if (!vision || (images.length === 0 && extraImages.length === 0)) return text;
  return [
    { type: 'text', text: text || '(see attached image)' },
    ...images.map((a): ContentPart => ({ type: 'image_url', image_url: { url: a.dataUrl! } })),
    ...extraImages.flatMap((f): ContentPart[] => [
      { type: 'text', text: `Project image: ${f.name}` },
      { type: 'image_url', image_url: { url: f.dataUrl! } },
    ]),
  ];
}

function mergeContent(a: string | ContentPart[], b: string | ContentPart[]): string | ContentPart[] {
  if (typeof a === 'string' && typeof b === 'string') return `${a}\n\n${b}`;
  const toParts = (c: string | ContentPart[]): ContentPart[] => (typeof c === 'string' ? [{ type: 'text', text: c }] : c);
  return [...toParts(a), ...toParts(b)];
}

interface ApiMessagesInput {
  system: string;
  history: Message[];
  vision: boolean;
  projectImages?: ProjectFile[];
}

export function toApiMessages({ system, history, vision, projectImages = [] }: ApiMessagesInput): ChatMessage[] {
  const lastUserIndex = history.map((m) => m.role).lastIndexOf('user');
  const out: ChatMessage[] = [{ role: 'system', content: system }];
  history.forEach((m, i) => {
    if (m.role === 'user') {
      const content = userContent(m, vision, i === lastUserIndex ? projectImages : []);
      const prev = out[out.length - 1];
      // Failed turns leave consecutive user messages; some providers reject that, so merge them.
      if (prev.role === 'user') prev.content = mergeContent(prev.content, content);
      else out.push({ role: 'user', content });
    } else if (m.role === 'assistant' && m.content.trim()) {
      out.push({ role: 'assistant', content: m.content });
    }
  });
  return out;
}

export function hasImageParts(messages: ChatMessage[]): boolean {
  return messages.some((m) => Array.isArray(m.content) && m.content.some((p) => p.type === 'image_url'));
}
