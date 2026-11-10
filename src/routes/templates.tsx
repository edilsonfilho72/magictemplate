import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { MagicLayout } from '../components/magictemplate/layout';
import { InstanceManager, InstanceSelector, useSharedInstanceWorkspace } from '../components/magictemplate/instance-controls';
import { deleteInstanceTemplate, importInstanceTemplates, saveInstanceTemplate, type InstanceTemplate } from '../components/magictemplate/instance-data';
import { MagicModal } from '../components/ui/magic-modal';
import { BackendConnectionCheck } from '../components/magictemplate/backend-connection-check';
import { Button, EmptyState, Icon, Input, Notice, PageHeader, Textarea } from '../components/ui/magic-ui';

export const Route = createFileRoute('/templates')({ component: TemplatesPage });

type Editor = { id: string | null; nome: string; conteudo: string };
type Feedback = { tone: 'success' | 'error'; text: string };

function countVariables(content: string) {
  return new Set(Array.from(content.matchAll(/\{\{\s*(\d+)\s*\}\}/g), match => String(Number(match[1])))).size;
}

function TemplatesPage() {
  const workspace = useSharedInstanceWorkspace();
  return <TemplatesContent key={`${workspace.userId}:${workspace.selection?.instanceId ?? ''}`} workspace={workspace} />;
}

function operationError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message;
  return 'Não foi possível concluir a operação.';
}

function TemplatesContent({ workspace }: { workspace: ReturnType<typeof useSharedInstanceWorkspace> }) {
  const { client, templates, selection } = workspace;
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [formError, setFormError] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const editorPanel = useRef<HTMLElement>(null);
  const active = useRef(true);
  const writing = useRef(false);
  const loading = workspace.loading || pending;
  const canWrite = !!client && !!selection && !loading;
  const visible = templates.filter(item => `${item.nome ?? ''} ${item.conteudo}`.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR')));

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  function openEditor(item?: InstanceTemplate) {
    if (!canWrite || writing.current) return;
    setEditor(item ? { id: item.id, nome: item.nome ?? '', conteudo: item.conteudo } : { id: null, nome: '', conteudo: '' });
    setFormError('');
    setFeedback(null);
    setDeleting(null);
    requestAnimationFrame(() => {
      if (!active.current) return;
      editorPanel.current?.scrollIntoView({ block: 'nearest' });
      editorPanel.current?.querySelector<HTMLInputElement>('input')?.focus();
    });
  }

  async function mutate(operation: () => Promise<unknown>, inEditor = false) {
    if (!canWrite || writing.current) return;
    writing.current = true;
    setPending(true);
    setFeedback(null);
    setFormError('');
    try {
      await operation();
      if (!active.current) return;
      setEditor(null);
      setDeleting(null);
      setSearch('');
      // La source de vérité reste le banco; ne pas appliquer de résultat local obsolète.
      await workspace.refresh();
    } catch (error) {
      if (!active.current) return;
      if (inEditor) setFormError(operationError(error));
      else setFeedback({ tone: 'error', text: operationError(error) });
    } finally {
      writing.current = false;
      if (active.current) setPending(false);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || !client || !selection || !canWrite) return;
    if (!editor.conteudo.trim()) {
      setFormError('Preencha o conteúdo do template. Espaços em branco não são suficientes.');
      return;
    }
    const input = { nome: editor.nome, conteudo: editor.conteudo };
    void mutate(() => saveInstanceTemplate(client, selection, input, editor.id ?? undefined), true);
  }

  function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !client || !selection || !canWrite) return;
    void mutate(() => importInstanceTemplates(client, selection, file));
  }

  function remove(id: string) {
    if (!client || !selection || !canWrite) return;
    void mutate(() => deleteInstanceTemplate(client, selection, id));
  }

  return <MagicLayout active="/templates">
    <PageHeader title="Gerenciar Templates" description="Organize os textos fixos e as variáveis das suas mensagens." actions={<><Button variant="secondary" disabled={!canWrite} onClick={() => fileInput.current?.click()}><Icon name="upload" />Importar</Button><Button disabled={!canWrite} onClick={() => openEditor()}><Icon name="plus" />Adicionar Template</Button></>} />
    <section aria-labelledby="templates-instance-title" className="mb-6 space-y-4 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon name="template" /></span><div><h2 id="templates-instance-title" className="text-base font-semibold text-slate-900">Instâncias</h2><p className="mt-1 text-sm text-slate-500">Selecione o contexto dos templates que deseja gerenciar.</p></div></div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <InstanceSelector id="templates-instance" instances={workspace.instances} value={selection?.instanceId ?? ''} loading={workspace.loading} disabled={pending || !client || !workspace.userId} onChange={workspace.selectInstance} />
        {client && workspace.userId && !loading && <InstanceManager client={client} onChanged={() => void workspace.refresh()} />}
      </div>
      {workspace.error && <Notice tone="error">{workspace.error}</Notice>}
      {workspace.persistenceWarning && <Notice>{workspace.persistenceWarning}</Notice>}
      {client && workspace.error && <Button variant="secondary" disabled={loading} onClick={() => void workspace.refresh()}>Tentar novamente</Button>}
      <BackendConnectionCheck />
    </section>
    <input ref={fileInput} type="file" accept=".json,application/json" className="hidden" aria-label="Importar templates em JSON" onChange={importFile} />
    <div className="mb-6 space-y-3">
      <Notice>{selection ? 'Os templates desta instância são consultados e gravados no banco da sua conta. A importação usa a instância selecionada e ignora IDs e proprietários do arquivo.' : 'Selecione ou crie uma instância para listar, adicionar e importar seus templates.'}</Notice>
      {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}
    </div>
    {editor && <MagicModal labelledBy="magic-editor-title" onClose={() => { if (!writing.current) { setEditor(null); setFormError(''); } }}><section ref={editorPanel} aria-labelledby="magic-editor-title" className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 id="magic-editor-title" className="mb-5 text-lg font-semibold text-slate-900">{editor.id ? 'Editar Template' : 'Adicionar Template'}</h2>
      <form onSubmit={save} className="space-y-5">
        <div><label htmlFor="template-name" className="mb-2 block text-sm font-medium text-slate-700">Nome <span className="font-normal text-slate-400">(opcional)</span></label><Input id="template-name" value={editor.nome} onChange={event => setEditor({ ...editor, nome: event.target.value })} placeholder="Dê um nome para identificar seu template" /></div>
        <div><label htmlFor="template-content" className="mb-2 block text-sm font-medium text-slate-700">Conteúdo <span className="text-blue-600">*</span></label><Textarea id="template-content" required rows={6} value={editor.conteudo} aria-invalid={!!formError} aria-describedby={`template-content-help${formError ? ' template-form-error' : ''}`} onChange={event => { setEditor({ ...editor, conteudo: event.target.value }); setFormError(''); }} placeholder="Escreva o texto fixo e indique onde entram as variáveis…" /><div id="template-content-help" className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-500"><span>Use {'{{1}}'}, {'{{2}}'}, {'{{3}}'} para identificar as variáveis.</span><span>{countVariables(editor.conteudo)} variável(is) identificada(s)</span></div></div>
        {formError && <div id="template-form-error"><Notice tone="error">{formError}</Notice></div>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button variant="secondary" disabled={pending} onClick={() => { setEditor(null); setFormError(''); }}>Cancelar</Button><Button type="submit" disabled={!canWrite}>{pending ? 'Salvando…' : 'Salvar'}</Button></div>
      </form>
    </section></MagicModal>}
    <section aria-label="Lista de templates" aria-busy={loading} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><h2 className="text-base font-semibold">Seus templates <span className="ml-2 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">{templates.length}</span></h2><div className="relative w-full sm:max-w-sm"><label htmlFor="template-search" className="sr-only">Buscar templates por nome ou conteúdo</label><span className="pointer-events-none absolute left-3 top-3 text-slate-400"><Icon name="search" /></span><Input id="template-search" type="search" className="pl-10" placeholder="Buscar templates…" value={search} onChange={event => setSearch(event.target.value)} /></div></div>
      {loading ? <div className="space-y-4"><Notice tone="loading">{pending ? 'Gravando alteração no banco…' : 'Carregando instâncias e templates…'}</Notice>{[0, 1].map(key => <div key={key} aria-hidden="true" className="h-32 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" />)}</div>
        : visible.length === 0 ? <EmptyState title={!selection ? 'Selecione uma instância' : templates.length ? 'Nenhum template encontrado' : 'Seu primeiro template começa aqui'} description={!selection ? 'A seleção de uma instância é obrigatória para acessar os templates.' : templates.length ? 'Tente buscar por outro nome ou por uma palavra do conteúdo.' : 'Adicione um template para organizar seus textos e identificar suas variáveis.'}>{templates.length ? <Button variant="secondary" onClick={() => setSearch('')}>Limpar busca</Button> : <Button disabled={!canWrite} onClick={() => openEditor()}><Icon name="plus" />Adicionar Template</Button>}</EmptyState>
        : <ul className="grid gap-4 md:grid-cols-2">{visible.map(item => <li key={item.id} className="flex min-w-0 flex-col rounded-xl border border-slate-200 p-5 transition hover:border-blue-200">
          <div className="flex items-start gap-3"><span className="rounded-lg bg-blue-50 p-2 text-blue-600"><Icon name="template" /></span><div className="min-w-0"><h3 className="break-words text-sm font-semibold text-slate-900">{item.nome || 'Template sem nome'}</h3><span className="mt-1 inline-block text-xs text-slate-500">{item.variaveis_count} {item.variaveis_count === 1 ? 'variável' : 'variáveis'}</span></div></div>
          <p className="my-4 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-500">{item.conteudo}</p>
          <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3"><Button variant="secondary" onClick={() => openEditor(item)} aria-label={`Editar ${item.nome || 'template sem nome'}`}><Icon name="edit" />Editar</Button><Button variant="secondary" onClick={() => setDeleting(item.id)} aria-label={`Excluir ${item.nome || 'template sem nome'}`}><Icon name="trash" />Excluir</Button></div>
          {deleting === item.id && <MagicModal labelledBy="magic-delete-title" onClose={() => { if (!writing.current) setDeleting(null); }}><div className="rounded-xl border border-red-100 bg-red-50 p-5"><h2 id="magic-delete-title" className="text-lg font-semibold text-red-800">Excluir este template?</h2><p className="mt-2 text-sm text-red-700">{item.nome || 'Template sem nome'} será excluído do banco, na instância selecionada. Esta ação não pode ser desfeita.</p><div className="mt-5 flex flex-wrap justify-end gap-2"><Button autoFocus variant="secondary" disabled={pending} onClick={() => setDeleting(null)}>Cancelar</Button><Button variant="danger" disabled={!canWrite} onClick={() => remove(item.id)}>Confirmar exclusão</Button></div></div></MagicModal>}
        </li>)}</ul>}
      <p className="mt-5 text-xs leading-relaxed text-slate-400">Importação: arquivo JSON de até 1 MB, com uma lista de até 100 objetos contendo conteudo obrigatório e nome opcional. As variáveis são contadas automaticamente.</p>
    </section>
  </MagicLayout>;
}
