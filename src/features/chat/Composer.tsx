import { ArrowUp, Paperclip, Square } from 'lucide-react';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cn } from '../../lib/cn';
import { FILE_ACCEPT, readFileAsAttachment } from '../../lib/files';
import { uid } from '../../lib/id';
import { strings } from '../../lib/strings';
import type { Attachment } from '../../lib/types';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { PendingChips, type PendingAttachment } from './AttachmentChips';

interface ComposerProps {
  onSend: (text: string, attachments: Attachment[]) => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
  placeholder: string;
  autoFocus?: boolean;
  /** Extra controls rendered after the attach button (e.g. the model menu). */
  tools?: ReactNode;
}

export function Composer({ onSend, onStop, streaming, disabled, placeholder, autoFocus, tools }: ComposerProps) {
  const [text, setText] = useState('');
  const [items, setItems] = useState<PendingAttachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputId = useId();
  const coarse = useMediaQuery('(pointer: coarse)');

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.4)}px`;
  }, [text]);

  useEffect(() => {
    if (autoFocus && !coarse) textareaRef.current?.focus();
  }, [autoFocus, coarse]);

  const addFiles = (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const key = uid();
      setItems((prev) => [...prev, { key, name: file.name, status: 'loading' }]);
      readFileAsAttachment(file).then(
        (attachment) => setItems((prev) => prev.map((p) => (p.key === key ? { ...p, status: 'ready', attachment } : p))),
        (err: unknown) =>
          setItems((prev) =>
            prev.map((p) =>
              p.key === key ? { ...p, status: 'error', error: err instanceof Error ? err.message.replace(`${file.name}: `, '') : String(err) } : p,
            ),
          ),
      );
    }
  };

  const ready = items.filter((i) => i.status === 'ready' && i.attachment).map((i) => i.attachment!);
  const loading = items.some((i) => i.status === 'loading');
  const canSend = !disabled && !streaming && !loading && (text.trim().length > 0 || ready.length > 0);

  const submit = () => {
    if (!canSend) return;
    onSend(text.trim(), ready);
    setText('');
    setItems([]);
    if (coarse) textareaRef.current?.blur();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !coarse) {
      e.preventDefault();
      submit();
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files);
    if (files.length) {
      e.preventDefault();
      addFiles(files);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        'rounded-3xl border bg-surface shadow-[0_1px_2px_rgba(26,22,20,0.04),0_8px_24px_-12px_rgba(26,22,20,0.12)] transition-colors',
        dragging ? 'border-accent' : 'border-line focus-within:border-ink-faint/60',
      )}
    >
      <PendingChips items={items} onRemove={(key) => setItems((prev) => prev.filter((p) => p.key !== key))} />
      <label htmlFor={`${inputId}-text`} className="sr-only">
        {placeholder}
      </label>
      <textarea
        id={`${inputId}-text`}
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        placeholder={placeholder}
        rows={1}
        enterKeyHint={coarse ? 'enter' : 'send'}
        className="block max-h-[40vh] w-full resize-none bg-transparent px-4 pt-3.5 pb-1 font-serif text-[16px] leading-relaxed text-ink outline-none placeholder:text-ink-faint lg:text-[17px]"
      />
      <div className="flex items-center justify-between gap-2 px-2 pb-2">
        <div className="flex min-w-0 items-center gap-1">
          <label
            htmlFor={`${inputId}-file`}
            title={strings.chat.attach}
            className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-muted hover:text-ink lg:size-9"
          >
            <Paperclip className="size-5" aria-hidden />
            <span className="sr-only">{strings.chat.attach}</span>
            <input
              id={`${inputId}-file`}
              type="file"
              multiple
              accept={FILE_ACCEPT}
              className="sr-only"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
          {tools}
        </div>
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label={strings.chat.stop}
            title={strings.chat.stop}
            className="inline-flex size-11 items-center justify-center rounded-xl bg-ink text-bg transition-opacity hover:opacity-85 lg:size-9"
          >
            <Square className="size-3.5 fill-current" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            aria-label={strings.chat.send}
            title={strings.chat.send}
            className="inline-flex size-11 items-center justify-center rounded-xl bg-accent text-on-accent transition-colors hover:bg-accent-strong disabled:bg-muted disabled:text-ink-faint lg:size-9"
          >
            <ArrowUp className="size-5" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
