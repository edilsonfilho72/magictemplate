import { createContext, useContext, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MagicModal } from '../ui/magic-modal';
import { Button, EmptyState, Input, Notice } from '../ui/magic-ui';
import {
  CommittedWriteError,
  createInstance,
  deleteEmptyInstance,
  loadInstances,
  loadInstanceTemplates,
  loadTemplateLibrary,
  renameInstance,
  type InstanceSelection,
  type InstanceTemplate,
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
  const workspace = useSharedInstanceWorkspace();
  const selected = instances.some(instance => instance.id === value) ? value : '';
  const placeholder = !workspace.client ? 'Conexão indisponível'
    : loading ? 'Carregando instâncias…'
    : workspace.error ? 'Não foi possível carregar as instâncias'
    : !workspace.userId ? 'Sessão necessária'
    : !instances.length ? 'Nenhuma instância disponível'
    : 'Selecione uma instância';
  const help = !workspace.client ? 'A configuração da conexão está indisponível. Consulte o diagnóstico abaixo.'
    : loading ? 'Consultando as instâncias e seus templates no banco da sua conta.'
    : workspace.error ? 'Consulte o aviso abaixo e use Verificar conexão e leitura para conferir a sessão e o acesso ao banco.'
    : !workspace.userId ? 'Entre na sua conta para consultar suas instâncias reais.'
    : !instances.length ? 'Nenhuma instância foi retornada para esta conta. Crie uma em Gerenciar instâncias, na tela Templates, ou verifique a conexão abaixo.'
    : 'A seleção é compartilhada com Gerar Mensagem, que usa somente templates associados. Na tela Templates, a biblioteca continua completa; o número indica a quantidade de associações.';
  return <div className="w-full min-w-0 flex-1 text-foreground" aria-busy={loading}>
    <label htmlFor={id} className="mb-2 block text-sm font-semibold text-slate-700">Instância <span className="text-blue-600">*</span></label>
    <select id={id} required value={selected} disabled={disabled || loading || !workspace.client || !workspace.userId || !instances.length}
      onChange={event => onChange(event.target.value)} aria-describedby={`${id}-help`}
      className="min-h-11 w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-600">
      <option value="">{placeholder}</option>
      {instances.map(instance => <option key={instance.id} value={instance.id}>{instance.name} ({instance.templateCount})</option>)}
    </select>
    <p id={`${id}-help`} aria-live="polite" className="mt-2 text-xs leading-relaxed text-slate-500">{help}</p>
  </div>;
}

export function InstanceWorkspaceControls({ id, disabled = false, onChange }: {
  id: string;
  disabled?: boolean;
  onChange?: (instanceId: string) => void;
}) {
  const workspace = useSharedInstanceWorkspace();
  const ready = !!workspace.client && !!workspace.userId && !workspace.loading && !workspace.error;
  const selected = ready ? workspace.instances.find(instance =>
    instance.id === workspace.selection?.instanceId && instance.user_id === workspace.userId) : undefined;

  return <div className="space-y-4 text-foreground">
    <InstanceSelector id={id} instances={workspace.instances} value={workspace.selection?.instanceId ?? ''} loading={workspace.loading} disabled={disabled || !ready} onChange={onChange ?? workspace.selectInstance} />
    {workspace.client && !workspace.loading && !workspace.userId && <Notice>Nenhuma sessão autenticada foi confirmada. Entre na sua conta para carregar e criar instâncias. Se já entrou, confira o diagnóstico de conexão abaixo.</Notice>}
    {workspace.userId && workspace.error && <Notice>A sessão foi identificada, mas a leitura das instâncias ou de seus templates falhou. Confira o erro abaixo e tente novamente; esta falha não significa que sua conta esteja sem instâncias.</Notice>}
    <div aria-live="polite" className="rounded-xl border border-slate-200 bg-background px-4 py-3">
      {selected ? <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 break-words text-sm text-slate-700">Instância selecionada: <span className="font-semibold text-slate-900">{selected.name}</span></p>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">{selected.templateCount} {selected.templateCount === 1 ? 'template disponível' : 'templates disponíveis'}</span>
      </div> : <p className="text-sm text-slate-500">{workspace.loading ? 'Consultando instâncias e disponibilidade…' : !ready ? 'Seleção indisponível. Confira o diagnóstico de sessão e conexão abaixo.' : 'Nenhuma instância selecionada.'}</p>}
    </div>
    {workspace.client
      ? <InstanceManager client={workspace.client} onChanged={workspace.refresh} disabled={disabled || workspace.loading} showEmptyState={ready && workspace.instances.length === 0} />
      : <Button variant="secondary" disabled>Gerenciar instâncias</Button>}
  </div>;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message;
  return 'Não foi possível concluir a operação. Tente novamente.';
}

type InstanceWorkspaceState = {
  userId: string;
  instances: InstanceWithCount[];
  selection: InstanceSelection | null;
  templates: InstanceTemplate[];
  loading: boolean;
  error: string;
  persistenceWarning: string;
};

function emptyWorkspace(loading = false): InstanceWorkspaceState {
  return {
    userId: '', instances: [], selection: null, templates: [],
    loading, error: '', persistenceWarning: '',
  };
}

function selectionStorageKey(userId: string) {
  return `magictemplate:last-instance:${userId}`;
}

// Recebe o cliente já existente; não cria conexão nem substitui autenticação.
export function useInstanceWorkspace(client: SupabaseClient) {
  const [state, setState] = useState<InstanceWorkspaceState>(() => emptyWorkspace(true));
  const generation = useRef(0);
  const owner = useRef<string | null>(null);
  const preferred = useRef<InstanceSelection | null>(null);

  const refresh = useCallback(async () => {
    const ticket = ++generation.current;
    setState(current => ({
      ...current, selection: null, templates: [], loading: true, error: '',
      persistenceWarning: '',
    }));

    let authenticatedUserId = '';
    try {
      // Separar a identidade da sessão do resultado das consultas ao banco.
      const { data, error } = await client.auth.getSession();
      if (ticket !== generation.current) return;
      if (error) throw error;
      authenticatedUserId = data.session?.user.id ?? '';
      if (!authenticatedUserId) throw new Error('Entre na sua conta para acessar instâncias e templates.');
      const result = await loadInstances(client);
      if (ticket !== generation.current) return;
      if (result.userId !== authenticatedUserId) throw new Error('A conta foi alterada. Atualize as instâncias novamente.');
      let persistenceWarning = '';
      let candidate = '';
      if (preferred.current?.userId === result.userId) {
        candidate = preferred.current.instanceId;
      } else {
        try {
          candidate = window.localStorage.getItem(selectionStorageKey(result.userId)) ?? '';
        } catch {
          persistenceWarning = 'Não foi possível recuperar a última instância neste navegador. Selecione-a novamente.';
        }
      }

      // O valor local é apenas uma preferência. A lista veio do banco,
      // filtrada pelo usuário autenticado; IDs ausentes ou de outro dono são descartados.
      const instance = result.instances.find(row =>
        row.id === candidate && row.user_id === result.userId);
      const selection = instance
        ? { userId: result.userId, instanceId: instance.id }
        : null;
      // loadInstanceTemplates revalida id + proprietário antes de consultar templates.
      const templates = selection ? await loadInstanceTemplates(client, selection) : [];
      if (ticket !== generation.current) return;

      owner.current = result.userId;
      preferred.current = { userId: result.userId, instanceId: selection?.instanceId ?? '' };
      try {
        const key = selectionStorageKey(result.userId);
        if (selection) window.localStorage.setItem(key, selection.instanceId);
        else window.localStorage.removeItem(key);
      } catch {
        persistenceWarning = 'A seleção funciona nesta tela, mas não pôde ser persistida neste navegador.';
      }
      setState({
        userId: result.userId,
        instances: result.instances,
        selection,
        templates,
        loading: false,
        error: '',
        persistenceWarning,
      });
    } catch (error) {
      if (ticket !== generation.current) return;
      // Uma falha de leitura não equivale a sair da conta. Limpar os dados
      // impede usar resultados antigos, sem apagar a identidade confirmada.
      setState({ ...emptyWorkspace(), userId: authenticatedUserId, error: errorMessage(error) });
    }
  }, [client]);

  useEffect(() => {
    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    owner.current = null;
    preferred.current = null;
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      const nextOwner = session?.user.id ?? '';
      if (nextOwner === owner.current) return;
      if (refreshTimer !== undefined) clearTimeout(refreshTimer);
      owner.current = nextOwner;
      preferred.current = null;
      generation.current += 1;
      setState({
        ...emptyWorkspace(!!nextOwner),
        userId: nextOwner,
        error: nextOwner ? '' : 'Entre na sua conta para acessar instâncias e templates.',
      });
      // A próxima tarefa permite concluir o callback de autenticação antes
      // de executar getSession novamente nas leituras do workspace.
      if (nextOwner) refreshTimer = setTimeout(() => {
        if (active && owner.current === nextOwner) void refresh();
      }, 0);
    });
    void refresh();
    return () => {
      active = false;
      if (refreshTimer !== undefined) clearTimeout(refreshTimer);
      generation.current += 1;
      data.subscription.unsubscribe();
    };
  }, [client, refresh]);

  const selectInstance = useCallback((instanceId: string) => {
    if (state.loading || !state.userId) return;
    if (instanceId && !state.instances.some(instance =>
      instance.id === instanceId && instance.user_id === state.userId)) return;
    preferred.current = { userId: state.userId, instanceId };
    // refresh limpa imediatamente a seleção e os templates anteriores.
    // As telas consumidoras devem limpar também seus campos locais nessa troca.
    void refresh();
  }, [state.loading, state.userId, state.instances, refresh]);

  return { ...state, selectInstance, refresh };
}

type SharedInstanceWorkspace = ReturnType<typeof useInstanceWorkspace> & {
  client: SupabaseClient | null;
};

const InstanceWorkspaceContext = createContext<SharedInstanceWorkspace | null>(null);

const unavailableWorkspace: SharedInstanceWorkspace = {
  ...emptyWorkspace(),
  client: null,
  error: 'O cliente Supabase ainda não foi vinculado ao workspace de instâncias. As operações estão indisponíveis até essa integração ser concluída.',
  selectInstance: () => {},
  refresh: async () => {},
};

function ConnectedInstanceWorkspace({ client, children }: {
  client: SupabaseClient;
  children: ReactNode;
}) {
  const workspace = useInstanceWorkspace(client);
  return <InstanceWorkspaceContext.Provider value={{ ...workspace, client }}>{children}</InstanceWorkspaceContext.Provider>;
}

// O cliente único é fornecido pela raiz; a sessão é acompanhada pelo workspace.
export function InstanceWorkspaceProvider({ client, configurationError, children }: {
  client?: SupabaseClient | null;
  configurationError?: string;
  children: ReactNode;
}) {
  if (client) return <ConnectedInstanceWorkspace client={client}>{children}</ConnectedInstanceWorkspace>;
  return <InstanceWorkspaceContext.Provider value={{
    ...unavailableWorkspace,
    error: configurationError || unavailableWorkspace.error,
  }}>{children}</InstanceWorkspaceContext.Provider>;
}

export function useSharedInstanceWorkspace() {
  const workspace = useContext(InstanceWorkspaceContext);
  if (!workspace) throw new Error('Provider de instâncias não encontrado.');
  return workspace;
}

export function InstanceManager({ client, onChanged, disabled = false, showEmptyState = false }: {
  client: SupabaseClient;
  onChanged: () => void | Promise<void>;
  disabled?: boolean;
  showEmptyState?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [instances, setInstances] = useState<InstanceWithCount[]>([]);
  const [library, setLibrary] = useState<InstanceTemplate[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const generation = useRef(0);
  const owner = useRef('');
  const writing = useRef(false);
  const busy = loading || saving;

  useEffect(() => {
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      const nextOwner = session?.user.id ?? '';
      if (nextOwner !== owner.current) {
        generation.current += 1;
        owner.current = nextOwner;
        setOpen(false);
        setInstances([]);
        setLibrary([]);
        setSelectedTemplateIds([]);
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
    const templates = await loadTemplateLibrary(client, result.userId);
    if (ticket !== generation.current) return false;
    owner.current = result.userId;
    setUserId(result.userId);
    setInstances(result.instances);
    setLibrary(templates);
    return true;
  }

  async function showManager() {
    const ticket = ++generation.current;
    setOpen(true);
    setLoading(true);
    setInstances([]);
    setLibrary([]);
    setSelectedTemplateIds([]);
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
    if (busy || writing.current || !userId) return;
    writing.current = true;
    const ticket = generation.current;
    setSaving(true);
    setFeedback(null);
    let outcome: { tone: 'success' | 'error'; text: string } = { tone: 'success', text: success };
    try {
      await operation();
      if (ticket !== generation.current) return;
      setEditingId(null);
      setDeletingId(null);
      setName('');
      setSelectedTemplateIds([]);
    } catch (error) {
      outcome = { tone: 'error', text: errorMessage(error) };
      if (ticket === generation.current && error instanceof CommittedWriteError) {
        // Resultado parcial ou incerto: exigir conferência, sem repetir o cadastro.
        setEditingId(null);
        setDeletingId(null);
        setName('');
        setSelectedTemplateIds([]);
      }
    } finally {
      try {
        if (ticket === generation.current) {
          // Mesmo erros comuns podem acompanhar uma resposta perdida após gravação.
          // Atualizar o workspace e o modal antes de liberar qualquer nova tentativa.
          await onChanged();
          if (ticket === generation.current && await refresh(ticket)) setFeedback(outcome);
        }
      } catch (cause) {
        if (ticket === generation.current) {
          setUserId('');
          setInstances([]);
          setLibrary([]);
          setFeedback({ tone: 'error', text: `${outcome.text} Não foi possível conferir os dados atualizados. Use Tentar novamente antes de realizar outra operação. ${errorMessage(cause)}` });
        }
      } finally {
        writing.current = false;
        if (ticket === generation.current) setSaving(false);
      }
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
      void mutate(() => createInstance(client, userId, name, selectedTemplateIds), 'Instância criada com as associações selecionadas.');
    }
  }

  function close() {
    if (busy) return;
    generation.current += 1;
    setOpen(false);
  }

  const deleting = instances.find(instance => instance.id === deletingId);

  return <div className="space-y-4 text-foreground">
    <Button variant="secondary" onClick={() => void showManager()} disabled={disabled || open}>Gerenciar instâncias</Button>
    {showEmptyState && <EmptyState title="Nenhuma instância cadastrada" description="Crie sua primeira instância para disponibilizar templates em Gerar Mensagem. Não é necessário ter templates na biblioteca para começar.">
      <Button onClick={() => void showManager()} disabled={disabled || open}>Criar primeira instância</Button>
    </EmptyState>}
    {open && <MagicModal labelledBy="magic-instances-title" onClose={close}>
      <section aria-busy={busy} className="space-y-5 rounded-xl bg-background p-1 sm:p-2">
        <div className="flex items-start justify-between gap-4">
          <div><h2 id="magic-instances-title" className="text-xl font-semibold text-slate-900">Gerenciar instâncias</h2><p className="mt-2 text-sm leading-relaxed text-slate-500">Associe templates da biblioteca sem duplicar seus textos. Excluir uma instância não exclui os templates da biblioteca central.</p></div>
          <Button variant="secondary" disabled={busy} onClick={close}>Fechar</Button>
        </div>
        {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}
        {loading ? <Notice tone="loading">Consultando instâncias e quantidade de templates…</Notice> : userId ? <>
          <form onSubmit={submit} className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
            <label htmlFor="magic-instance-name" className="block text-sm font-medium text-slate-700">{editingId ? 'Renomear instância' : 'Criar instância'}</label>
            <Input id="magic-instance-name" required disabled={saving} value={name} onChange={event => setName(event.target.value)} placeholder="Nome da instância" />
            {!editingId && library.length > 0 && <label className="flex items-start gap-3 rounded-xl border border-blue-100 bg-white p-3 text-sm text-slate-700">
              <input type="checkbox" disabled={saving} checked={library.every(template => selectedTemplateIds.includes(template.id))} onChange={event => setSelectedTemplateIds(event.target.checked ? library.map(template => template.id) : [])} className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500" />
              <span>Selecionar todos os templates atuais <span className="mt-1 block text-xs text-slate-500">{selectedTemplateIds.length} de {library.length} selecionados. Templates cadastrados depois não serão associados automaticamente.</span></span>
            </label>}
            {!editingId && <fieldset disabled={saving} className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 text-foreground"><legend className="px-1 text-sm font-semibold text-slate-700">Associar templates existentes</legend><p className="text-xs leading-relaxed text-slate-500">Escolha os templates disponíveis nesta nova instância. Nenhum conteúdo será duplicado.</p><div className="max-h-48 space-y-2 overflow-y-auto">{library.length ? library.map(template => <label key={template.id} className="flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={selectedTemplateIds.includes(template.id)} onChange={event => setSelectedTemplateIds(current => event.target.checked ? [...current, template.id] : current.filter(id => id !== template.id))} className="h-4 w-4 shrink-0 rounded border-slate-300 accent-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500" /><span className="break-words">{template.nome || 'Template sem nome'}</span></label>) : <p className="text-sm text-slate-500">A biblioteca ainda não contém templates.</p>}</div></fieldset>}
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
                  <Button variant="danger" disabled={saving} aria-label={`Excluir ${instance.name}`} onClick={() => { setDeletingId(instance.id); setEditingId(null); setName(''); setFeedback(null); }}>Excluir</Button>
                </div>
              </div>
            </li>)}
          </ul>}
          {deleting && <div role="group" aria-labelledby="magic-instance-delete-title" className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <h3 id="magic-instance-delete-title" className="text-sm font-semibold text-red-800">Excluir {deleting.name}?</h3>
            <p className="text-sm leading-relaxed text-red-700">Esta instância e suas associações serão removidas. Os templates continuarão na biblioteca central e nas demais instâncias associadas. Esta ação não pode ser desfeita.</p>
            <div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" disabled={saving} onClick={() => setDeletingId(null)}>Cancelar</Button><Button variant="danger" disabled={saving} onClick={() => void mutate(() => deleteEmptyInstance(client, { userId, instanceId: deleting.id }), 'Instância excluída. Os templates permanecem na biblioteca central.')}>Confirmar exclusão</Button></div>
          </div>}
        </> : <Button variant="secondary" onClick={() => void showManager()}>Tentar novamente</Button>}
      </section>
    </MagicModal>}
  </div>;
}
