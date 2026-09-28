import { CircleCheck, LoaderCircle, Plug, TriangleAlert } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { ApiError, testConnection, type Endpoint } from '../../lib/openai';
import { strings } from '../../lib/strings';

type State = { status: 'idle' } | { status: 'testing' } | { status: 'ok'; message: string } | { status: 'error'; message: string };

export function ConnectionTest({ endpoint, model }: { endpoint: Endpoint; model: string }) {
  const [state, setState] = useState<State>({ status: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  const run = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ status: 'testing' });
    try {
      const result = await testConnection(endpoint, model.trim(), controller.signal);
      setState({
        status: 'ok',
        message: result.via === 'models' ? strings.settings.testOkModels(result.count) : strings.settings.testOkChat,
      });
    } catch (err) {
      if (err instanceof ApiError && err.kind === 'aborted') return;
      setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Button onClick={run} disabled={state.status === 'testing'} className="self-start">
        {state.status === 'testing' ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
        ) : (
          <Plug className="size-4" aria-hidden />
        )}
        {state.status === 'testing' ? strings.settings.testing : strings.settings.test}
      </Button>
      <div aria-live="polite">
        {state.status === 'ok' && (
          <p className="flex items-center gap-2 text-sm text-ink-soft">
            <CircleCheck className="size-4 text-green-600" aria-hidden /> {state.message}
          </p>
        )}
        {state.status === 'error' && (
          <p className="flex items-start gap-2 whitespace-pre-wrap rounded-xl bg-danger-soft p-3 text-sm text-danger">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {state.message}
          </p>
        )}
      </div>
    </div>
  );
}
