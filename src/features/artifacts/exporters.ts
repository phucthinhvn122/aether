import { createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { safeFilename, saveBlob } from '../../lib/download';
import { Markdown } from '../markdown/Markdown';
import { parseBody, splitSlides, type BodyBlock, type TextRun } from './slides';
import { Slide, SLIDE_HEIGHT, SLIDE_WIDTH } from './SlidesPreview';
import type { ArtifactBlock } from './types';

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
const PAGE_MARGIN_X = 72;
const PAGE_MARGIN_Y = 64;
/** iOS Safari refuses canvases above ~16.7M pixels, so every page is captured separately. */
const CAPTURE_SCALE = 2;

type Html2Canvas = typeof import('html2canvas-pro').default;

async function loadLibs() {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')]);
  return { html2canvas, jsPDF };
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

async function settle(doc: Document): Promise<void> {
  await nextFrame();
  await nextFrame();
  await doc.fonts?.ready;
  const pending = Array.from(doc.images)
    .filter((img) => !img.complete)
    .map((img) => new Promise<void>((resolve) => {
      img.addEventListener('load', () => resolve(), { once: true });
      img.addEventListener('error', () => resolve(), { once: true });
    }));
  await Promise.race([Promise.all(pending), new Promise((r) => setTimeout(r, 4000))]);
}

function rgbOf(color: string): [number, number, number] {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [255, 255, 255];
}

/** Renders React content invisibly (behind the app shell) so it can be measured and captured. */
async function mountOffscreen(node: ReactNode, width: number): Promise<{ host: HTMLDivElement; dispose: () => void }> {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  Object.assign(host.style, { position: 'absolute', left: '0', top: '0', width: `${width}px`, zIndex: '-1', pointerEvents: 'none' });
  document.body.appendChild(host);
  const root = createRoot(host);
  flushSync(() => root.render(node));
  await settle(document);
  return {
    host,
    dispose: () => {
      root.unmount();
      host.remove();
    },
  };
}

/** Candidate page-break positions: bottoms of block elements, relative to `root`'s top. */
function breakPoints(root: HTMLElement): number[] {
  const top = root.getBoundingClientRect().top;
  const points = new Set<number>();
  root.querySelectorAll('p, li, tr, pre, blockquote, h1, h2, h3, h4, h5, h6, img, hr, table, section, article, div, figure').forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.height === 0) return;
    // Never leave a heading alone at the bottom of a page.
    if (/^H\d$/.test(el.tagName)) return;
    points.add(Math.round(rect.bottom - top));
  });
  return [...points].sort((a, b) => a - b);
}

function paginate(total: number, pageHeight: number, points: number[]): Array<[number, number]> {
  const pages: Array<[number, number]> = [];
  let start = 0;
  while (start < total - 1) {
    const limit = start + pageHeight;
    if (limit >= total) {
      pages.push([start, total]);
      break;
    }
    const candidates = points.filter((p) => p > start + pageHeight * 0.55 && p <= limit);
    const end = candidates.length ? candidates[candidates.length - 1] : limit;
    pages.push([start, end]);
    start = end;
  }
  return pages;
}

/** `x`/`y` are offsets inside `el` (html2canvas-pro adds the element's own position). */
function captureRegion(html2canvas: Html2Canvas, el: HTMLElement, y: number, height: number, background = '#ffffff') {
  const rect = el.getBoundingClientRect();
  return html2canvas(el, {
    scale: CAPTURE_SCALE,
    backgroundColor: background,
    useCORS: true,
    logging: false,
    x: 0,
    y,
    width: Math.ceil(rect.width),
    height: Math.ceil(height),
    windowWidth: el.ownerDocument.documentElement.scrollWidth,
    windowHeight: el.ownerDocument.documentElement.scrollHeight,
  });
}

/** Paginated A4 capture of `el`, placed inside the given page margins. */
async function renderPages(el: HTMLElement, margins: { x: number; y: number }, background?: string): Promise<Blob> {
  const { html2canvas, jsPDF } = await loadLibs();
  const contentWidth = A4_WIDTH - margins.x * 2;
  const pageHeight = A4_HEIGHT - margins.y * 2;
  const scale = contentWidth / el.getBoundingClientRect().width;
  const total = el.scrollHeight;
  const pages = paginate(total, pageHeight / scale, breakPoints(el));
  const pdf = new jsPDF({ unit: 'px', format: [A4_WIDTH, A4_HEIGHT], hotfixes: ['px_scaling'], compress: true });
  for (let i = 0; i < pages.length; i++) {
    const [start, end] = pages[i];
    const canvas = await captureRegion(html2canvas, el, start, end - start, background);
    if (i > 0) pdf.addPage([A4_WIDTH, A4_HEIGHT], 'portrait');
    if (background) {
      pdf.setFillColor(...rgbOf(background));
      pdf.rect(0, 0, A4_WIDTH, A4_HEIGHT, 'F');
    }
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', margins.x, margins.y, contentWidth, (end - start) * scale);
  }
  return pdf.output('blob');
}

async function markdownPdf(content: string): Promise<Blob> {
  const { host, dispose } = await mountOffscreen(
    createElement('div', { className: 'paper-theme pdf-page' }, createElement(Markdown, { content })),
    A4_WIDTH,
  );
  try {
    const prose = host.querySelector<HTMLElement>('.prose-aether')!;
    return await renderPages(prose, { x: PAGE_MARGIN_X, y: PAGE_MARGIN_Y });
  } finally {
    dispose();
  }
}

async function slidesPdf(content: string): Promise<Blob> {
  const slides = splitSlides(content);
  const { html2canvas, jsPDF } = await loadLibs();
  const { host, dispose } = await mountOffscreen(
    createElement(
      'div',
      null,
      slides.map((slide, i) => createElement(Slide, { key: i, slide, index: i, total: slides.length })),
    ),
    SLIDE_WIDTH,
  );
  try {
    const pdf = new jsPDF({ unit: 'px', format: [SLIDE_WIDTH, SLIDE_HEIGHT], orientation: 'landscape', hotfixes: ['px_scaling'], compress: true });
    const nodes = Array.from(host.querySelectorAll<HTMLElement>('[data-slide]'));
    for (let i = 0; i < nodes.length; i++) {
      const canvas = await html2canvas(nodes[i], { scale: CAPTURE_SCALE, backgroundColor: '#ffffff', useCORS: true, logging: false });
      if (i > 0) pdf.addPage([SLIDE_WIDTH, SLIDE_HEIGHT], 'landscape');
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, SLIDE_WIDTH, SLIDE_HEIGHT);
    }
    return pdf.output('blob');
  } finally {
    dispose();
  }
}

/** Injected into the artifact's sandboxed iframe: once its scripts have run, send back a static copy of the DOM. */
const SNAPSHOT_SCRIPT = `<script>(function(){
  function snap(){
    document.querySelectorAll('canvas').forEach(function(c){
      try { var img = document.createElement('img'); img.src = c.toDataURL('image/png'); img.style.cssText = c.style.cssText;
        img.width = c.clientWidth || c.width; img.height = c.clientHeight || c.height; img.className = c.className; c.replaceWith(img); } catch (e) {}
    });
    document.querySelectorAll('input,textarea').forEach(function(i){ i.setAttribute('value', i.value); });
    var clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('script').forEach(function(s){ s.remove(); });
    parent.postMessage({ type: 'aether-snapshot', html: '<!doctype html>' + clone.outerHTML }, '*');
  }
  window.addEventListener('load', function(){ setTimeout(snap, 900); });
})();</script>`;

function withSnapshotScript(html: string): string {
  return /<\/body>/i.test(html) ? html.replace(/<\/body>(?![\s\S]*<\/body>)/i, `${SNAPSHOT_SCRIPT}</body>`) : `${html}${SNAPSHOT_SCRIPT}`;
}

function hiddenFrame(width: number): HTMLIFrameElement {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'absolute', left: '0', top: '0', width: `${width}px`, height: `${A4_HEIGHT}px`, border: '0', zIndex: '-1', pointerEvents: 'none' });
  return frame;
}

function snapshotHtml(html: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const frame = hiddenFrame(A4_WIDTH);
    frame.setAttribute('sandbox', 'allow-scripts');
    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
      frame.remove();
    };
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow || (e.data as { type?: string })?.type !== 'aether-snapshot') return;
      cleanup();
      resolve(String((e.data as { html: string }).html));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('The page took too long to render.'));
    }, 20_000);
    window.addEventListener('message', onMessage);
    frame.srcdoc = withSnapshotScript(html);
    document.body.appendChild(frame);
  });
}

async function htmlPdf(html: string): Promise<Blob> {
  const snapshot = await snapshotHtml(html);
  // Scripts stay disabled here, so granting same-origin (needed to read the DOM) is safe.
  const frame = hiddenFrame(A4_WIDTH);
  frame.setAttribute('sandbox', 'allow-same-origin');
  const loaded = new Promise<void>((r) => frame.addEventListener('load', () => r(), { once: true }));
  frame.srcdoc = snapshot;
  document.body.appendChild(frame);
  try {
    await loaded;
    const doc = frame.contentDocument!;
    frame.style.height = `${doc.documentElement.scrollHeight}px`;
    await settle(doc);
    const background = [doc.body, doc.documentElement]
      .map((el) => getComputedStyle(el).backgroundColor)
      .find((c) => c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c));
    return await renderPages(doc.documentElement, { x: 0, y: 0 }, background ?? 'rgb(255, 255, 255)');
  } finally {
    frame.remove();
  }
}

export async function exportPdf(artifact: ArtifactBlock): Promise<void> {
  const blob =
    artifact.type === 'slides'
      ? await slidesPdf(artifact.content)
      : artifact.type === 'html'
        ? await htmlPdf(artifact.content)
        : await markdownPdf(artifact.type === 'code' ? `\`\`\`${artifact.language ?? ''}\n${artifact.content}\n\`\`\`` : artifact.content);
  await saveBlob(`${safeFilename(artifact.title)}.pdf`, blob);
}

// ---------- PowerPoint ----------

const INK = '1A1614';
const INK_SOFT = '5B534D';
const ACCENT = 'C45C26';
const FONT_HEAD = 'Georgia';
const FONT_BODY = 'Calibri';

type PptxText = { text: string; options?: Record<string, unknown> };

function runsToPptx(runs: TextRun[], options: Record<string, unknown>, breakLine: boolean): PptxText[] {
  const list = runs.length ? runs : [{ text: ' ' }];
  return list.map((r, i) => ({
    text: r.text,
    options: { ...(i === 0 ? options : {}), bold: r.bold || (options.bold as boolean | undefined), italic: r.italic, ...(breakLine && i === list.length - 1 && { breakLine: true }) },
  }));
}

function blocksToText(blocks: BodyBlock[]): PptxText[] {
  const out: PptxText[] = [];
  blocks.forEach((b, i) => {
    const last = i === blocks.length - 1;
    if (b.kind === 'bullet') {
      out.push(...runsToPptx(b.runs, { bullet: b.ordered ? { type: 'number' } : true, indentLevel: b.level, paraSpaceAfter: 6 }, !last));
    } else if (b.kind === 'paragraph') {
      out.push(...runsToPptx(b.runs, { bold: b.heading, paraSpaceAfter: 8 }, !last));
    } else if (b.kind === 'code') {
      out.push({ text: b.text, options: { fontFace: 'Consolas', fontSize: 14, color: INK_SOFT, ...(!last && { breakLine: true }) } });
    }
  });
  return out;
}

export async function exportPptx(artifact: ArtifactBlock): Promise<void> {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = artifact.title;
  const slides = splitSlides(artifact.content);

  slides.forEach((source, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: 'FFFFFF' };
    slide.addShape('rect', { x: 0, y: 0, w: 0.12, h: 7.5, fill: { color: ACCENT }, line: { color: ACCENT } });
    const blocks = parseBody(source.body);

    if (source.cover) {
      slide.addText(source.title, { x: 1, y: 2.3, w: 11.3, h: 1.5, fontFace: FONT_HEAD, fontSize: 44, bold: true, color: INK, valign: 'bottom', fit: 'shrink' });
      slide.addShape('rect', { x: 1, y: 3.95, w: 0.9, h: 0.06, fill: { color: ACCENT }, line: { color: ACCENT } });
      const subtitle = blocks.flatMap((b) => ('runs' in b ? b.runs.map((r) => r.text) : [])).join(' ');
      if (subtitle) slide.addText(subtitle, { x: 1, y: 4.2, w: 11.3, h: 1.2, fontFace: FONT_BODY, fontSize: 22, color: INK_SOFT, valign: 'top', fit: 'shrink' });
    } else {
      if (source.title) {
        slide.addText(source.title, { x: 0.7, y: 0.4, w: 11.9, h: 0.9, fontFace: FONT_HEAD, fontSize: 30, bold: true, color: INK, valign: 'middle', fit: 'shrink' });
        slide.addShape('rect', { x: 0.7, y: 1.32, w: 0.7, h: 0.05, fill: { color: ACCENT }, line: { color: ACCENT } });
      }
      const table = blocks.find((b): b is Extract<BodyBlock, { kind: 'table' }> => b.kind === 'table');
      const text = blocksToText(blocks.filter((b) => b.kind !== 'table'));
      const top = source.title ? 1.6 : 0.6;
      const textHeight = table ? (text.length ? 1.5 : 0) : 7.5 - top - 0.5;
      if (text.length) {
        slide.addText(text, { x: 0.7, y: top, w: 11.9, h: textHeight, fontFace: FONT_BODY, fontSize: 20, color: INK, valign: 'top', fit: 'shrink' });
      }
      if (table) {
        const [head, ...rows] = table.rows;
        const cell = (t: string, header: boolean) => ({
          text: t,
          options: { bold: header, color: header ? 'FFFFFF' : INK, fill: { color: header ? ACCENT : 'FFFFFF' } },
        });
        slide.addTable([head.map((t) => cell(t, true)), ...rows.map((r) => r.map((t) => cell(t, false)))], {
          x: 0.7,
          y: top + textHeight + (text.length ? 0.2 : 0),
          w: 11.9,
          fontFace: FONT_BODY,
          fontSize: 14,
          border: { type: 'solid', pt: 0.75, color: 'E5DFD6' },
          autoPage: false,
        });
      }
      slide.addText(`${index + 1} / ${slides.length}`, { x: 11.6, y: 6.95, w: 1.4, h: 0.35, fontSize: 11, color: '8C837B', align: 'right' });
    }
    if (source.notes) slide.addNotes(source.notes);
  });

  const blob = (await pptx.write({ outputType: 'blob' })) as Blob;
  await saveBlob(`${safeFilename(artifact.title)}.pptx`, blob);
}
