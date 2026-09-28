import { cn } from '../lib/cn';

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden className={cn('size-6', className)}>
      <g stroke="currentColor" strokeWidth="44" strokeLinecap="round">
        <line x1="256" y1="96" x2="256" y2="416" />
        <line x1="117" y1="176" x2="395" y2="336" />
        <line x1="117" y1="336" x2="395" y2="176" />
      </g>
    </svg>
  );
}
