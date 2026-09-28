import { uid } from './id';
import { extractPdfText } from './pdf';
import { strings } from './strings';
import type { Attachment, AttachmentKind } from './types';

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1600;
const MAX_TEXT_CHARS = 400_000;

/** `accept` string that works with the iOS Safari file picker. */
export const FILE_ACCEPT =
  'image/png,image/jpeg,image/webp,image/*,application/pdf,.pdf,text/plain,.txt,text/markdown,.md,application/json,.json,text/csv,.csv';

const TEXT_EXT = /\.(txt|md|markdown|json|csv)$/i;

export function detectKind(file: File): AttachmentKind | null {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return 'pdf';
  if (file.type.startsWith('text/') || file.type === 'application/json' || TEXT_EXT.test(file.name)) return 'text';
  return null;
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = src;
  });
}

/** Downscale large photos so they fit comfortably in IndexedDB and model context. */
async function imageToDataUrl(file: File): Promise<string> {
  const original = await readAsDataUrl(file);
  try {
    const img = await loadImage(original);
    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    if (longest <= MAX_IMAGE_EDGE && file.size < 1.5 * 1024 * 1024) return original;
    const scale = Math.min(1, MAX_IMAGE_EDGE / longest);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    return canvas.toDataURL(type, 0.85);
  } catch {
    return original;
  }
}

export async function readFileAsAttachment(file: File): Promise<Attachment> {
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name}: ${strings.errors.fileTooLarge}`);
  const kind = detectKind(file);
  if (!kind) throw new Error(`${file.name}: ${strings.errors.fileUnsupported}`);
  const base = { id: uid(), name: file.name, mime: file.type || 'application/octet-stream', kind, size: file.size };
  try {
    if (kind === 'image') return { ...base, dataUrl: await imageToDataUrl(file) };
    if (kind === 'pdf') return { ...base, textExtract: await extractPdfText(file) };
    return { ...base, textExtract: (await file.text()).slice(0, MAX_TEXT_CHARS) };
  } catch (err) {
    const reason = err instanceof Error ? err.message : '';
    throw new Error(`${file.name}: ${strings.errors.fileRead}${reason ? ` (${reason})` : ''}`);
  }
}
