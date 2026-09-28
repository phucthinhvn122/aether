import { FileText, LoaderCircle, TriangleAlert, X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { formatBytes } from '../../lib/format';
import { strings } from '../../lib/strings';
import type { Attachment } from '../../lib/types';

export interface PendingAttachment {
  key: string;
  name: string;
  status: 'loading' | 'ready' | 'error';
  attachment?: Attachment;
  error?: string;
}

interface ChipProps {
  name: string;
  detail?: string;
  thumb?: string;
  status?: PendingAttachment['status'];
  onRemove?: () => void;
}

export function AttachmentChip({ name, detail, thumb, status = 'ready', onRemove }: ChipProps) {
  return (
    <div
      className={cn(
        'relative flex h-14 max-w-56 items-center gap-2 rounded-xl border bg-surface pl-1.5 font-sans',
        status === 'error' ? 'border-danger/40' : 'border-line',
        onRemove ? 'pr-1' : 'pr-3',
      )}
    >
      <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
        {status === 'loading' ? (
          <LoaderCircle className="size-4 animate-spin text-ink-faint" aria-hidden />
        ) : status === 'error' ? (
          <TriangleAlert className="size-4 text-danger" aria-hidden />
        ) : thumb ? (
          <img src={thumb} alt="" className="size-full object-cover" />
        ) : (
          <FileText className="size-4 text-ink-soft" aria-hidden />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-ink">{name}</span>
        {detail && <span className="block truncate text-[11px] text-ink-faint">{detail}</span>}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${strings.common.remove} ${name}`}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg text-ink-faint hover:bg-muted hover:text-ink lg:size-8"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

export function attachmentDetail(a: Attachment): string {
  const kind = a.kind === 'pdf' ? 'PDF' : a.kind === 'image' ? 'Image' : a.name.split('.').pop()?.toUpperCase() || 'Text';
  return `${kind} · ${formatBytes(a.size)}`;
}

interface PendingChipsProps {
  items: PendingAttachment[];
  onRemove: (key: string) => void;
}

export function PendingChips({ items, onRemove }: PendingChipsProps) {
  if (items.length === 0) return null;
  return (
    <div className="flex gap-2 overflow-x-auto px-3 pt-3 pb-1">
      {items.map((item) => (
        <AttachmentChip
          key={item.key}
          name={item.name}
          status={item.status}
          thumb={item.attachment?.dataUrl}
          detail={
            item.status === 'loading'
              ? strings.chat.extracting
              : item.status === 'error'
                ? item.error
                : item.attachment && attachmentDetail(item.attachment)
          }
          onRemove={() => onRemove(item.key)}
        />
      ))}
    </div>
  );
}
