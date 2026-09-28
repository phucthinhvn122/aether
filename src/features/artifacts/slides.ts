/**
 * Slides artifacts are markdown: slides separated by a line containing only `---`.
 * The first `#`/`##` heading is the slide title; `Note:` lines become speaker notes.
 */

export interface SlideSource {
  title: string;
  /** Markdown body without the title and notes. */
  body: string;
  notes: string;
  /** A title slide: heading plus at most a short subtitle. */
  cover: boolean;
}

const SEPARATOR = /^\s*(---|\*\*\*|___)\s*$/;
const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const TITLE = /^\s{0,3}#{1,2}\s+(.+?)\s*#*\s*$/;
const NOTE = /^\s*(?:note|notes|speaker notes|ghi chú)\s*:\s*(.*)$/i;

export function splitSlides(markdown: string): SlideSource[] {
  const chunks: string[][] = [[]];
  let fence: string | null = null;
  for (const line of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const f = FENCE.exec(line);
    if (f) fence = fence ? (line.trim().startsWith(fence) ? null : fence) : f[1];
    if (!fence && SEPARATOR.test(line)) chunks.push([]);
    else chunks[chunks.length - 1].push(line);
  }
  return chunks
    .map((lines, index) => {
      let title = '';
      const body: string[] = [];
      const notes: string[] = [];
      let inNotes = false;
      for (const line of lines) {
        const t = !title && !inNotes ? TITLE.exec(line) : null;
        if (t) {
          title = t[1].replace(/[*_`]/g, '').trim();
          continue;
        }
        const n = NOTE.exec(line);
        if (n) {
          inNotes = true;
          if (n[1]) notes.push(n[1]);
          continue;
        }
        (inNotes ? notes : body).push(line);
      }
      const text = body.join('\n').trim();
      const plain = text.replace(/[#>*_`-]/g, '').trim();
      const cover = Boolean(title) && !/^\s*([-*+]|\d+\.|\|)/m.test(text) && plain.length <= 160 && (index === 0 || !plain);
      return { title, body: text, notes: notes.join('\n').trim(), cover };
    })
    .filter((s) => s.title || s.body);
}

export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

export type BodyBlock =
  | { kind: 'paragraph'; runs: TextRun[]; heading?: boolean }
  | { kind: 'bullet'; runs: TextRun[]; level: number; ordered: boolean }
  | { kind: 'code'; text: string }
  | { kind: 'table'; rows: string[][] };

/** `**bold**`, `*italic*`, `code` and links → plain runs (for PowerPoint text boxes). */
export function inlineRuns(text: string): TextRun[] {
  const cleaned = text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
  const runs: TextRun[] = [];
  const re = /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned))) {
    if (m.index > last) runs.push({ text: cleaned.slice(last, m.index) });
    runs.push(m[2] !== undefined ? { text: m[2], bold: true } : { text: m[4], italic: true });
    last = m.index + m[0].length;
  }
  if (last < cleaned.length) runs.push({ text: cleaned.slice(last) });
  return runs.filter((r) => r.text);
}

function tableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => inlineRuns(c.trim()).map((r) => r.text).join(''));
}

export function parseBody(markdown: string): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  const lines = markdown.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = FENCE.exec(line);
    if (fence) {
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i].trim().startsWith(fence[1]); i++) code.push(lines[i]);
      blocks.push({ kind: 'code', text: code.join('\n') });
      continue;
    }
    if (/^\s*\|/.test(line)) {
      const rows: string[][] = [];
      for (; i < lines.length && /^\s*\|/.test(lines[i]); i++) {
        if (!/^\s*\|?\s*:?-{2,}/.test(lines[i])) rows.push(tableRow(lines[i]));
      }
      i--;
      if (rows.length) blocks.push({ kind: 'table', rows });
      continue;
    }
    const bullet = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (bullet) {
      const level = Math.min(Math.floor(bullet[1].replace(/\t/g, '  ').length / 2), 3);
      blocks.push({ kind: 'bullet', runs: inlineRuns(bullet[3]), level, ordered: /\d/.test(bullet[2]) });
      continue;
    }
    const heading = /^\s{0,3}#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ kind: 'paragraph', runs: inlineRuns(heading[1]), heading: true });
      continue;
    }
    const text = line.replace(/^\s*>\s?/, '').trim();
    if (text) blocks.push({ kind: 'paragraph', runs: inlineRuns(text) });
  }
  return blocks;
}
