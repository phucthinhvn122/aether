import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { copyText } from '../lib/clipboard';
import { cn } from '../lib/cn';
import { strings } from '../lib/strings';

interface CopyButtonProps {
  text: string | (() => string);
  label?: string;
  showLabel?: boolean;
  className?: string;
}

export function CopyButton({ text, label = strings.common.copy, showLabel, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const onClick = async () => {
    const ok = await copyText(typeof text === 'function' ? text() : text);
    if (ok) setCopied(true);
  };

  const Icon = copied ? Check : Copy;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={copied ? strings.common.copied : label}
      title={copied ? strings.common.copied : label}
      className={cn(
        'inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2 text-xs text-ink-soft transition-colors hover:bg-muted hover:text-ink lg:min-h-8 lg:min-w-8',
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
      {showLabel && <span>{copied ? strings.common.copied : strings.common.copy}</span>}
    </button>
  );
}
