import { KeyRound } from 'lucide-react';
import { Logo } from '../../components/Logo';
import { routeHref } from '../../lib/router';
import { strings } from '../../lib/strings';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return strings.chat.greetingMorning;
  if (h < 18) return strings.chat.greetingAfternoon;
  return strings.chat.greetingEvening;
}

export function Greeting({ projectName }: { projectName?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center animate-fade-in">
      <h1 className="flex items-center gap-3 font-serif text-3xl font-normal tracking-tight text-ink sm:text-4xl">
        <Logo className="size-8 text-accent sm:size-9" />
        {greeting()}
      </h1>
      <p className="max-w-md text-sm text-ink-faint">
        {projectName ? `${strings.chat.inProject} · ${projectName}` : strings.chat.emptyHint}
      </p>
    </div>
  );
}

export function NotConfigured() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent-soft/60 p-3 pl-4 text-sm text-ink">
      <KeyRound className="size-4 shrink-0 text-accent" aria-hidden />
      <span className="flex-1">{strings.chat.notConfigured}</span>
      <a
        href={routeHref({ name: 'settings' })}
        className="inline-flex min-h-11 items-center rounded-xl bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-strong lg:min-h-9"
      >
        {strings.chat.openSettings}
      </a>
    </div>
  );
}

export function Suggestions({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {strings.chat.suggestions.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onPick(s)}
          className="min-h-11 rounded-full border border-line bg-surface/70 px-4 text-sm text-ink-soft transition-colors hover:bg-muted hover:text-ink lg:min-h-9"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
