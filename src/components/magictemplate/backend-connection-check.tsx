import { useEffect, useRef, useState } from 'react';
import { verifyBackendReads } from '../../integrations/supabase/client';
import { useSharedInstanceWorkspace } from './instance-controls';
import { Button, Notice } from '../ui/magic-ui';

export function BackendConnectionCheck() {
  const workspace = useSharedInstanceWorkspace();
  const { client } = workspace;
  const [pending, setPending] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [checkedAt, setCheckedAt] = useState('');
  const generation = useRef(0);
  const running = useRef(false);

  useEffect(() => {
    const { data } = client?.auth.onAuthStateChange(() => {
      generation.current += 1;
      running.current = false;
      setPending(false);
      setResults([]);
      setError('');
      setCheckedAt('');
    }) ?? {};
    return () => {
      generation.current += 1;
      running.current = false;
      data?.subscription.unsubscribe();
    };
  }, [client]);

  async function verify() {
    if (running.current || !client) return;
    running.current = true;
    const ticket = ++generation.current;
    setPending(true);
    setResults([]);
    setError('');
    setCheckedAt('');
    try {
      const report = await verifyBackendReads();
      if (ticket !== generation.current) return;
      setResults(report);
      setCheckedAt(new Date().toLocaleString('pt-BR'));
    } catch (cause) {
      if (ticket !== generation.current) return;
      setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a verificação.');
    } finally {
      if (ticket === generation.current) {
        running.current = false;
        setPending(false);
      }
    }
  }

  return <section aria-label="Diagnóstico da conexão" className="rounded-xl border border-slate-200 bg-background p-4 text-foreground">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-slate-800">Conexão com o banco</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">Verifica a sessão atual e faz leituras reais de instances e templates, sem alterar dados ou permissões.</p>
      </div>
      <Button variant="secondary" className="shrink-0" disabled={pending || !client} onClick={() => void verify()}>{pending ? 'Verificando leituras…' : 'Verificar conexão e leitura'}</Button>
    </div>
    <div aria-live="polite" aria-busy={pending} className="mt-3 space-y-3">
      {!client && <Notice tone="error">{workspace.error || 'A conexão com o banco está indisponível.'}</Notice>}
      {client && !workspace.loading && !workspace.userId && !workspace.error && <Notice>Não há sessão autenticada. Entre na sua conta para consultar instâncias e templates.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {checkedAt && <p className="text-xs text-slate-500">Verificação executada em {checkedAt}. Confira o resultado de cada tabela abaixo.</p>}
      {results.length > 0 && <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-600">{results.map((result, index) => <li key={index}>{result}</li>)}</ul>}
    </div>
  </section>;
}
