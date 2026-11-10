import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MagicModal } from '../ui/magic-modal';
import { Button, EmptyState, Input, Notice } from '../ui/magic-ui';
import {
  createInstance,
  deleteEmptyInstance,
  loadInstances,
  renameInstance,
  type InstanceWithCount,
} from './instance-data';

export function InstanceSelector({
  id,
  instances,
  value,
  onChange,
  loading = false,
  disabled = false,
}: {
  id: string;
  instances: InstanceWithCount[];
  value: string;
  onChange: (instanceId: string) => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const selected = instances.some(instance => instance.id === value) ? value : '';
  return <div className="min-w-0 flex-1 text-foreground">
    <label htmlFor={id} className="mb-2 block text-sm font-medium text-slate-700">Instância <span className="text-blue-600">*</span></label>
    <select id={id} required value={selected} disabled={disabled || loading || !instances.length}
      onChange={event => onChange(event.target.value)} aria-describedby={`${id}-help`}
      className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400">
      <option value="">{loading ? 'Carregando instâncias…' : 'Selecione uma instância'}</option>
      {instances.map(instance => <option key={instance.id} value={instance.id}>{instance.name} ({instance.templateCount})</option>)}
    </select>
    <p id={`${id}-help`} className="mt-2 text-xs leading-relaxed text-slate-500">Somente os templates da instância selecionada devem ser usados nesta mensagem.</p>
  </div>;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message;
  return 'Não foi possível concluir a operação. Tente novamente.';
}

export function InstanceManager({ client, onChanged }: {
  client: SupabaseClient;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [instances, setInstances] = useState<InstanceWithCount[]>([]);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const generation = useRef(0);
  const owner = useRef('');
  const busy = loading || saving;

  useEffect(() => {
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      const nextOwner = session?.user.id ?? '';
      if (nextOwner !== owner.current) {
        generation.current += 1;
        owner.current = nextOwner;
        setOpen(false);
        setInstances([]);
        setUserId('');
        setName('');
        setEditingId(null);
        setDeletingId(null);
        setFeedback(null);
        setLoading(false);
        setSaving(false);
      }
    });
    return () => {
      generation.current += 1;
      data.subscription.unsubscribe();
    };
  }, [client]);

  async function refresh(ticket: number) {
    const result = await loadInstances(client);
    if (ticket !== generation.current) return false;
    owner.current = result.userId;
    setUserId(result.userId);
    setInstances(result.instances);
    return true;
  }

  async function showManager() {
    const ticket = ++generation.current;
    setOpen(true);
    setLoading(true);
    setInstances([]);
    setUserId('');
    setEditingId(null);
    setDeletingId(null);
    setName('');
    setFeedback(null);
    try {
      await refresh(ticket);
    } catch (error) {
      if (ticket === generation.current) setFeedback({ tone: 'error', text: errorMessage(error) });
    } finally {
      if (ticket === generation.current) setLoading(false);
    }
  }

  async function mutate(operation: () => Promise<unknown>, success: string) {
    if (busy || !userId) return;
    const ticket = generation.current;
    setSaving(true);
    setFeedback(null);
    let written = false;
    try {
      await operation();
      written = true;
      if (ticket !== generation.current) return;
      setEditingId(null);
      setDeletingId(null);
      setName('');
      onChanged();
      if (await refresh(ticket)) setFeedback({ tone: 'success', text: success });
    } catch (error) {
      if (ticket === generation.current) {
        if (written) {
          setUserId('');
          setInstances([]);
        }
        setFeedback({ tone: 'error', text: written
          ? 'A alteração foi gravada, mas a lista não pôde ser atualizada. Feche e abra o gerenciamento novamente.'
          : errorMessage(error) });
      }
    } finally {
      if (ticket === generation.current) setSaving(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setFeedback({ tone: 'error', text: 'Informe o nome da instância.' });
      return;
    }
    if (editingId) {
      void mutate(() => renameInstance(client, { userId, instanceId: editingId }, name), 'Instância renomeada.');
    } else {
      void mutate(() => createInstance(client, userId, name), 'Instância criada.');
    }
  }

  function close() {
    if (busy) return;
    generation.current += 1;
    setOpen(false);
  }

  const deleting = instances.find(instance => instance.id === deletingId);

  return <div className="text-foreground">
    <Button variant="secondary" onClick={() => void showManager()} disabled={open}>Gerenciar instâncias</Button>
    {open && <MagicModal labelledBy="magic-instances-title" onClose={close}>
      <section aria-busy={busy} className="space-y-5 rounded-xl bg-background p-1 sm:p-2">
        <div className="flex items-start justify-between gap-4">
          <div><h2 id="magic-instances-title" className="text-xl font-semibold text-slate-900">Gerenciar instâncias</h2><p className="mt-2 text-sm leading-relaxed text-slate-500">Separe seus templates por contexto. Apenas instâncias vazias podem ser excluídas.</p></div>
          <Button variant="secondary" disabled={busy} onClick={close}>Fechar</Button>
        </div>
        {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}
        {loading ? <Notice tone="loading">Consultando instâncias e quantidade de templates…</Notice> : userId ? <>
          <form onSubmit={submit} className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
            <label htmlFor="magic-instance-name" className="block text-sm font-medium text-slate-700">{editingId ? 'Renomear instância' : 'Criar instância'}</label>
            <Input id="magic-instance-name" required disabled={saving} value={name} onChange={event => setName(event.target.value)} placeholder="Nome da instância" />
            <div className="flex flex-wrap justify-end gap-2">
              {editingId && <Button variant="secondary" disabled={saving} onClick={() => { setEditingId(null); setName(''); }}>Cancelar edição</Button>}
              <Button type="submit" disabled={saving || !name.trim()}>{saving ? 'Salvando…' : editingId ? 'Salvar nome' : 'Criar instância'}</Button>
            </div>
          </form>
          {instances.length === 0 ? <EmptyState title="Nenhuma instância cadastrada" description="Crie uma instância para organizar seus templates." /> : <ul className="space-y-3">
            {instances.map(instance => <li key={instance.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0"><h3 className="break-words text-sm font-semibold text-slate-900">{instance.name}</h3><p className="mt-1 text-xs text-slate-500">{instance.templateCount} template(s)</p></div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button variant="secondary" disabled={saving} aria-label={`Renomear ${instance.name}`} onClick={() => { setEditingId(instance.id); setName(instance.name); setDeletingId(null); setFeedback(null); }}>Renomear</Button>
                  <Button variant="danger" disabled={saving || instance.templateCount > 0} title={instance.templateCount ? 'A instância contém templates.' : 'Excluir instância vazia'} aria-label={`Excluir ${instance.name}`} onClick={() => { setDeletingId(instance.id); setFeedback(null); }}>Excluir</Button>
                </div>
              </div>
            </li>)}
          </ul>}
          {deleting && <div role="group" aria-labelledby="magic-instance-delete-title" className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <h3 id="magic-instance-delete-title" className="text-sm font-semibold text-red-800">Excluir {deleting.name}?</h3>
            <p className="text-sm leading-relaxed text-red-700">A quantidade de templates será verificada novamente antes de excluir. Esta ação não pode ser desfeita.</p>
            <div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" disabled={saving} onClick={() => setDeletingId(null)}>Cancelar</Button><Button variant="danger" disabled={saving} onClick={() => void mutate(() => deleteEmptyInstance(client, { userId, instanceId: deleting.id }), 'Instância vazia excluída.')}>Confirmar exclusão</Button></div>
          </div>}
        </> : <Button variant="secondary" onClick={() => void showManager()}>Tentar novamente</Button>}
      </section>
    </MagicModal>}
  </div>;
}
