import { Ellipsis, Folder, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { navigate, routeHref } from '../../lib/router';
import { strings } from '../../lib/strings';
import type { Conversation } from '../../lib/types';
import { deleteConversation, renameConversation, togglePin } from './actions';

interface ConversationItemProps {
  conversation: Conversation;
  snippet?: string;
  active: boolean;
}

function MenuItem({ icon, label, onClick, danger }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm hover:bg-muted lg:min-h-9',
        danger ? 'text-danger' : 'text-ink',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

export function ConversationItem({ conversation, snippet, active }: ConversationItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(conversation.title);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);

  const commitRename = async () => {
    setRenaming(false);
    if (draft.trim() && draft.trim() !== conversation.title) await renameConversation(conversation.id, draft);
  };

  const onDelete = async () => {
    setMenuOpen(false);
    if (!window.confirm(strings.sidebar.confirmDelete)) return;
    await deleteConversation(conversation.id);
    if (active) navigate({ name: 'new' }, true);
  };

  if (renaming) {
    return (
      <div className="px-1 py-0.5">
        <label htmlFor={`rename-${conversation.id}`} className="sr-only">
          {strings.common.rename}
        </label>
        <input
          id={`rename-${conversation.id}`}
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void commitRename();
            if (e.key === 'Escape') {
              setDraft(conversation.title);
              setRenaming(false);
            }
          }}
          className="h-11 w-full rounded-lg border border-accent bg-surface px-3 text-sm text-ink outline-none lg:h-9"
        />
      </div>
    );
  }

  return (
    <div ref={rootRef} className="group relative">
      <a
        href={routeHref({ name: 'chat', id: conversation.id })}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex min-h-11 flex-col justify-center rounded-lg py-1.5 pr-11 pl-3 text-sm transition-colors lg:min-h-9',
          active ? 'bg-muted text-ink' : 'text-ink-soft hover:bg-muted/70 hover:text-ink',
        )}
      >
        <span className="flex items-center gap-1.5">
          {conversation.projectId && <Folder className="size-3.5 shrink-0 text-ink-faint" aria-hidden />}
          <span className="truncate">{conversation.title}</span>
        </span>
        {snippet && <span className="truncate text-xs text-ink-faint">{snippet}</span>}
      </a>
      <button
        type="button"
        aria-label={strings.sidebar.chatActions}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
        className={cn(
          'absolute top-1/2 right-0.5 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-ink-faint hover:text-ink lg:size-8',
          !menuOpen && !active && 'pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100',
        )}
      >
        <Ellipsis className="size-4" aria-hidden />
      </button>
      {menuOpen && (
        <div
          role="menu"
          className="absolute top-full right-0 z-30 mt-1 w-44 rounded-xl border border-line bg-surface p-1 shadow-lg animate-fade-in"
        >
          <MenuItem
            icon={<Pencil className="size-4" aria-hidden />}
            label={strings.common.rename}
            onClick={() => {
              setMenuOpen(false);
              setDraft(conversation.title);
              setRenaming(true);
            }}
          />
          <MenuItem
            icon={conversation.pinned ? <PinOff className="size-4" aria-hidden /> : <Pin className="size-4" aria-hidden />}
            label={conversation.pinned ? strings.sidebar.unpin : strings.sidebar.pin}
            onClick={() => {
              setMenuOpen(false);
              void togglePin(conversation.id, !conversation.pinned);
            }}
          />
          <MenuItem icon={<Trash2 className="size-4" aria-hidden />} label={strings.common.delete} onClick={onDelete} danger />
        </div>
      )}
    </div>
  );
}
