import { ChevronDown, Lightbulb } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import { strings } from '../../lib/strings';

interface ThinkingBlockProps {
  text: string;
  /** True while reasoning tokens are still arriving. */
  active: boolean;
}

export function ThinkingBlock({ text, active }: ThinkingBlockProps) {
  const [manual, setManual] = useState<boolean | null>(null);
  const open = manual ?? active;
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (active && open && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [text, active, open]);

  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-line bg-surface/60 font-sans">
      <button
        type="button"
        onClick={() => setManual(!open)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm text-ink-soft hover:text-ink"
      >
        <Lightbulb className={cn('size-4', active && 'text-accent')} aria-hidden />
        <span className={cn('flex-1', active && 'animate-shimmer')}>
          {active ? `${strings.chat.thinking}…` : strings.chat.thoughtProcess}
        </span>
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div
          ref={bodyRef}
          className={cn(
            'scroll-area whitespace-pre-wrap border-t border-line/70 px-4 py-3 font-serif text-[15px] leading-relaxed text-ink-soft',
            active ? 'max-h-60' : 'max-h-[28rem]',
          )}
        >
          {text}
        </div>
      )}
    </div>
  );
}
