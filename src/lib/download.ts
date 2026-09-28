import { Capacitor, registerPlugin } from '@capacitor/core';
import { isNativeApp } from './platform';

interface NativeSharePlugin {
  shareFile(options: { filename: string; data: string }): Promise<{ completed: boolean }>;
}

/** Implemented in ios/App/App/NativeSharePlugin.swift — WKWebView ignores <a download>, so files go through the share sheet. */
const NativeShare = registerPlugin<NativeSharePlugin>('NativeShare');

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file.'));
    reader.readAsDataURL(blob);
  });
}

export async function saveBlob(filename: string, blob: Blob): Promise<void> {
  if (isNativeApp() && Capacitor.isPluginAvailable('NativeShare')) {
    await NativeShare.shareFile({ filename, data: await blobToBase64(blob) });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(filename: string, content: string, mime = 'text/plain'): Promise<void> {
  return saveBlob(filename, new Blob([content], { type: `${mime};charset=utf-8` }));
}

export function safeFilename(name: string): string {
  return (
    name
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 80) || 'artifact'
  );
}
