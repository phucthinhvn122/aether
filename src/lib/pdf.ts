import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

const MAX_CHARS = 400_000;

interface TextItemLike {
  str?: string;
  hasEOL?: boolean;
}

export async function extractPdfText(file: Blob): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const pages: string[] = [];
  let total = 0;
  try {
    for (let i = 1; i <= doc.numPages && total < MAX_CHARS; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = (content.items as TextItemLike[])
        .map((item) => (item.str ?? '') + (item.hasEOL ? '\n' : ''))
        .join('')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      pages.push(`--- Page ${i} ---\n${text}`);
      total += text.length;
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return pages.join('\n\n').slice(0, MAX_CHARS);
}
