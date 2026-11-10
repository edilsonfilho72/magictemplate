import { useEffect, useRef, useState } from 'react';
import { supabase, supabaseConfigurationError, verifyBackendReads } from '../../integrations/supabase/client';
import { Button, Notice } from '../ui/magic-ui';

export function BackendConnectionCheck() {
  const [pending, setPending] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [checkedAt, setCheckedAt] = useState('');
  const generation = useRef(0);
  const running = useRef(false);

  useEffect(() => {
    const { data } = supabase?.auth.onAuthStateChange(() => {
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
  }, []);

  async function verify() {
    if (running.current) return;
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

  return <details className="rounded-xl border border-slate-200 bg-background p-4 text-foreground">
    <summary className="cursor-pointer text-sm font-medium focus-visible:outline-blue-500">Verificar conexão com o backend</summary>
    <div className="mt-4 space-y-3" aria-busy={pending}>
      <p className="text-sm leading-relaxed text-slate-500">Usa o cliente e a sessão atuais para validar a autenticação e consultar instances e templates. Não cria dados, não altera permissões e não testa gravação.</p>
      <Button variant="secondary" disabled={pending || !supabase} onClick={() => void verify()}>{pending ? 'Verificando leituras…' : 'Verificar conexão e leitura'}</Button>
      {!supabase && <Notice tone="error">{supabaseConfigurationError}</Notice>}
      <div aria-live="polite" className="space-y-2">
        {error && <Notice tone="error">{error}</Notice>}
        {checkedAt && <p className="text-xs text-slate-500">Verificação concluída em {checkedAt}</p>}
        {results.length > 0 && <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-600">{results.map((result, index) => <li key={index}>{result}</li>)}</ul>}
      </div>
    </div>
  </details>;
}
