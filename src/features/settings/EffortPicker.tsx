import { cn } from '../../lib/cn';
import { strings } from '../../lib/strings';
import type { ReasoningEffort } from '../../lib/types';

const EFFORTS: ReasoningEffort[] = ['auto', 'low', 'medium', 'high'];

export function EffortPicker({ value, onChange }: { value: ReasoningEffort; onChange: (v: ReasoningEffort) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span id="effort-label" className="text-sm font-medium text-ink">
        {strings.settings.thinkingEffort}
      </span>
      <div role="radiogroup" aria-labelledby="effort-label" className="flex rounded-xl border border-line bg-surface p-1">
        {EFFORTS.map((e) => (
          <button
            key={e}
            type="button"
            role="radio"
            aria-checked={value === e}
            onClick={() => onChange(e)}
            className={cn(
              'min-h-11 flex-1 rounded-lg text-sm transition-colors lg:min-h-9',
              value === e ? 'bg-accent-soft font-medium text-accent-strong' : 'text-ink-soft hover:bg-muted',
            )}
          >
            {strings.modelMenu.efforts[e]}
          </button>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-ink-faint">{strings.settings.thinkingEffortHint}</p>
    </div>
  );
}
