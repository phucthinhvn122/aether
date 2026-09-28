import { LoaderCircle, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { TextField } from '../../components/Field';
import { selectModel } from '../../lib/db';
import { listModels, type Endpoint } from '../../lib/openai';
import { strings } from '../../lib/strings';
import { cn } from '../../lib/cn';

interface ModelPickerProps {
  value: string;
  onChange: (model: string) => void;
  endpoint: Endpoint;
  initialModels: string[];
  onModelsLoaded: (models: string[]) => void;
}

export function ModelPicker({ value, onChange, endpoint, initialModels, onModelsLoaded }: ModelPickerProps) {
  const [models, setModels] = useState<string[]>(initialModels);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await listModels(endpoint);
      setModels(list);
      onModelsLoaded(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    const list = q && !models.includes(value) ? models.filter((m) => m.toLowerCase().includes(q)) : models;
    return list.slice(0, 60);
  }, [models, value]);

  return (
    <div className="flex flex-col gap-2">
      <TextField
        label={strings.settings.model}
        hint={models.length ? strings.settings.modelsLoaded(models.length) : strings.settings.modelHint}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="gpt-4o-mini"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        trailing={
          <button
            type="button"
            onClick={load}
            disabled={loading || !endpoint.baseUrl.trim()}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-accent hover:bg-accent-soft disabled:opacity-40 lg:min-h-8"
          >
            {loading ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> : <RefreshCw className="size-3.5" aria-hidden />}
            {strings.settings.loadModels}
          </button>
        }
      />
      {error && <p className="whitespace-pre-wrap rounded-xl bg-danger-soft p-3 text-xs text-danger">{error}</p>}
      {filtered.length > 0 && (
        <div className="scroll-area max-h-48 rounded-xl border border-line bg-surface p-1" role="listbox" aria-label={strings.settings.model}>
          {filtered.map((m) => (
            <button
              key={m}
              type="button"
              role="option"
              aria-selected={m === value}
              onClick={() => {
                onChange(m);
                void selectModel(m);
              }}
              className={cn(
                'block min-h-11 w-full truncate rounded-lg px-3 text-left font-mono text-xs hover:bg-muted lg:min-h-8',
                m === value ? 'bg-accent-soft text-accent-strong' : 'text-ink-soft',
              )}
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
