import { useState } from 'react';
import { Button, EmptyState, Icon, Notice, Textarea } from '../ui/magic-ui';

export type VariableResult = { id: string; value: string };

type Props = {
  items: VariableResult[];
  onChange: (id: string, value: string) => void;
  status?: 'idle' | 'loading' | 'error' | 'ready';
  error?: string;
};

function VariableSection({ item, onChange }: { item: VariableResult; onChange: Props['onChange'] }) {
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const fieldId = `magic-variable-${item.id}`;

  async function copy() {
    setFeedback(null);
    try {
      await navigator.clipboard.writeText(item.value);
      setFeedback({ tone: 'success', text: `Complemento de {{${item.id}}} copiado.` });
    } catch {
      setFeedback({ tone: 'error', text: 'Não foi possível copiar. Selecione o texto deste campo e copie manualmente.' });
    }
  }

  return <section aria-labelledby={`${fieldId}-label`} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <label id={`${fieldId}-label`} htmlFor={fieldId} className="flex items-center gap-2 text-sm font-medium text-slate-600"><span className="rounded-lg bg-blue-50 px-3 py-1.5 font-mono font-bold text-blue-700">{`{{${item.id}}}`}</span>Complemento</label>
      <Button variant="secondary" onClick={copy} disabled={!item.value.trim()} aria-label={`Copiar complemento da variável {{${item.id}}}`}><Icon name="copy" />Copiar</Button>
    </div>
    <Textarea id={fieldId} rows={3} value={item.value} onChange={event => { setFeedback(null); onChange(item.id, event.target.value); }} />
    {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}
  </section>;
}

export function VariableResults({ items, onChange, status = 'idle', error }: Props) {
  return <section aria-labelledby="magic-results-title" aria-busy={status === 'loading'} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-2"><h2 id="magic-results-title" className="text-base font-semibold text-slate-900">Complementos</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">Uma seção por variável</span></div>
    {status === 'loading' ? <div className="space-y-4"><Notice tone="loading">Processando os complementos…</Notice>{[0, 1].map(key => <div key={key} aria-hidden="true" className="h-32 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" />)}</div>
      : status === 'error' ? <Notice tone="error">{error || 'Não foi possível processar os complementos. Tente novamente.'}</Notice>
      : items.length > 0 ? <div className="space-y-4"><Notice tone="success">Complementos disponíveis. Edite e copie cada variável individualmente.</Notice>{items.map(item => <VariableSection key={item.id} item={item} onChange={onChange} />)}</div>
      : <EmptyState title="Seus complementos aparecerão aqui" description="Cada variável terá seu próprio campo editável e botão de copiar. Nenhum resultado foi gerado." />}
  </section>;
}
