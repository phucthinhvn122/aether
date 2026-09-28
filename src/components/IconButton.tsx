import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
  size?: 'md' | 'sm';
  active?: boolean;
}

/** Square icon button with a 44px touch target on mobile. */
export function IconButton({ label, children, size = 'md', active, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg text-ink-soft transition-colors',
        'hover:bg-muted hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent',
        size === 'md' ? 'size-11 lg:size-9' : 'size-11 lg:size-8',
        active && 'bg-muted text-ink',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
