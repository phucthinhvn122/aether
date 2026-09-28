import { useState } from 'react';
import { Button } from '../../components/Button';
import { TextAreaField, TextField } from '../../components/Field';
import { strings } from '../../lib/strings';

interface ProjectFormProps {
  initialName?: string;
  initialInstructions?: string;
  submitLabel: string;
  onSubmit: (name: string, instructions: string) => void | Promise<void>;
  onCancel?: () => void;
}

export function ProjectForm({ initialName = '', initialInstructions = '', submitLabel, onSubmit, onCancel }: ProjectFormProps) {
  const [name, setName] = useState(initialName);
  const [instructions, setInstructions] = useState(initialInstructions);
  const [busy, setBusy] = useState(false);
  const dirty = name !== initialName || instructions !== initialInstructions;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        try {
          await onSubmit(name, instructions);
        } finally {
          setBusy(false);
        }
      }}
    >
      <TextField
        label={strings.projects.name}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={strings.projects.namePlaceholder}
        required
        autoFocus={!initialName}
      />
      <TextAreaField
        label={strings.projects.instructions}
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        placeholder={strings.projects.instructionsPlaceholder}
        rows={5}
      />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            {strings.common.cancel}
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={busy || !name.trim() || (!!initialName && !dirty)}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
