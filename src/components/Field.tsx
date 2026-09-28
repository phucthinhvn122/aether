import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

const CONTROL =
  'w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-ink placeholder:text-ink-faint outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent/20';

interface FieldShellProps {
  id: string;
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  trailing?: ReactNode;
}

function FieldShell({ id, label, hint, children, trailing }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {trailing}
      </div>
      {children}
      {hint && <p className="text-xs leading-relaxed text-ink-faint">{hint}</p>}
    </div>
  );
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  trailing?: ReactNode;
  adornment?: ReactNode;
}

export function TextField({ label, hint, trailing, adornment, className, ...rest }: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} trailing={trailing}>
      <div className="relative">
        <input id={id} className={cn(CONTROL, adornment ? 'pr-12' : '', className)} {...rest} />
        {adornment && <div className="absolute inset-y-0 right-0 flex items-center">{adornment}</div>}
      </div>
    </FieldShell>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: ReactNode;
}

export function TextAreaField({ label, hint, className, ...rest }: TextAreaFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint}>
      <textarea id={id} className={cn(CONTROL, 'min-h-28 resize-y leading-relaxed', className)} {...rest} />
    </FieldShell>
  );
}

interface ToggleProps {
  label: string;
  hint?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ label, hint, checked, onChange, disabled }: ToggleProps) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {hint && <p className="text-xs leading-relaxed text-ink-faint">{hint}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="flex min-h-11 shrink-0 items-center disabled:opacity-40"
      >
        <span
          className={cn(
            'relative inline-flex h-7 w-12 items-center rounded-full transition-colors',
            checked ? 'bg-accent' : 'bg-line',
          )}
        >
          <span
            className={cn(
              'inline-block size-5 rounded-full bg-white shadow transition-transform',
              checked ? 'translate-x-6' : 'translate-x-1',
            )}
          />
        </span>
      </button>
    </div>
  );
}
