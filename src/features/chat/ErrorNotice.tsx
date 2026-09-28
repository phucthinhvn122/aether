import { RotateCcw, Settings, TriangleAlert } from 'lucide-react';
import { routeHref } from '../../lib/router';
import { strings } from '../../lib/strings';

interface ErrorNoticeProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorNotice({ message, onRetry }: ErrorNoticeProps) {
  const stopped = message === strings.chat.stopped;
  if (stopped) return <p className="font-sans text-sm italic text-ink-faint">{message}</p>;
  return (
    <div role="alert" className="mt-2 rounded-xl border border-danger/30 bg-danger-soft p-3 font-sans text-sm text-danger">
      <div className="flex items-start gap-2">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="min-w-0 flex-1 whitespace-pre-wrap break-words">{message}</p>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 pl-6">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-danger/30 bg-surface px-3 text-xs font-medium lg:min-h-8"
          >
            <RotateCcw className="size-3.5" aria-hidden /> {strings.chat.retry}
          </button>
        )}
        <a
          href={routeHref({ name: 'settings' })}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-medium underline-offset-2 hover:underline lg:min-h-8"
        >
          <Settings className="size-3.5" aria-hidden /> {strings.chat.openSettings}
        </a>
      </div>
    </div>
  );
}
