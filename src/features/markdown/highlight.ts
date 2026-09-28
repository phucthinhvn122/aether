import hljs from 'highlight.js/lib/common';

const ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  html: 'xml',
  svg: 'xml',
  vue: 'xml',
  md: 'markdown',
  rs: 'rust',
  kt: 'kotlin',
  cs: 'csharp',
  'c++': 'cpp',
  golang: 'go',
  rb: 'ruby',
};

export function normalizeLanguage(lang: string | undefined): string | undefined {
  if (!lang) return undefined;
  const lower = lang.toLowerCase();
  return ALIASES[lower] ?? lower;
}

/** Returns highlighted HTML (escaped by highlight.js) or null when the language is unknown. */
export function highlightCode(code: string, lang: string | undefined): string | null {
  const language = normalizeLanguage(lang);
  if (!language || !hljs.getLanguage(language)) return null;
  try {
    return hljs.highlight(code, { language, ignoreIllegals: true }).value;
  } catch {
    return null;
  }
}
