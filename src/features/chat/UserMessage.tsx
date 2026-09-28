import { Pencil } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { CopyButton } from '../../components/CopyButton';
import { IconButton } from '../../components/IconButton';
import { strings } from '../../lib/strings';
import type { Message } from '../../lib/types';
import { AttachmentChip, attachmentDetail } from './AttachmentChips';

interface UserMessageProps {
  message: Message;
  canEdit: boolean;
  onEdit: (content: string) => void;
}

export function UserMessage({ message, canEdit, onEdit }: UserMessageProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing || !ref.current) return;
    const el = ref.current;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = 'auto';
    ref.current.style.height = `${ref.current.scrollHeight}px`;
  }, [draft, editing]);

  const attachments = message.attachments ?? [];

  if (editing) {
    return (
      <div className="ml-auto w-full max-w-[85%] rounded-2xl border border-line bg-surface p-3">
        <label htmlFor={`edit-${message.id}`} className="sr-only">
          {strings.chat.editMessage}
        </label>
        <textarea
          id={`edit-${message.id}`}
          ref={ref}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
          className="block max-h-[50vh] w-full resize-none bg-transparent font-serif text-[16px] leading-relaxed text-ink outline-none"
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setEditing(false)}>
            {strings.common.cancel}
          </Button>
          <Button
            variant="primary"
            disabled={!draft.trim() && attachments.length === 0}
            onClick={() => {
              setEditing(false);
              onEdit(draft.trim());
            }}
          >
            {strings.chat.saveAndSend}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex flex-col items-end gap-1.5">
      {attachments.length > 0 && (
        <div className="flex max-w-[85%] flex-wrap justify-end gap-2">
          {attachments.map((a) =>
            a.kind === 'image' && a.dataUrl ? (
              <img key={a.id} src={a.dataUrl} alt={a.name} className="max-h-48 max-w-full rounded-xl border border-line object-cover" />
            ) : (
              <AttachmentChip key={a.id} name={a.name} detail={attachmentDetail(a)} />
            ),
          )}
        </div>
      )}
      {message.content && (
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-muted px-4 py-2.5 font-serif text-[16px] leading-relaxed text-ink lg:text-[17px]">
          {message.content}
        </div>
      )}
      <div className="flex items-center gap-0.5 transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-within:opacity-100">
        <CopyButton text={message.content} label={strings.chat.copyMessage} />
        {canEdit && (
          <IconButton
            label={strings.chat.editMessage}
            size="sm"
            onClick={() => {
              setDraft(message.content);
              setEditing(true);
            }}
          >
            <Pencil className="size-4" aria-hidden />
          </IconButton>
        )}
      </div>
    </div>
  );
}
