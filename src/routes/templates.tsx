import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { MagicLayout } from '../components/magictemplate/layout';
import { InstanceWorkspaceControls, useSharedInstanceWorkspace } from '../components/magictemplate/instance-controls';
import { CommittedWriteError, deleteInstanceTemplate, importInstanceTemplates, loadTemplateLibrary, removeTemplateAssociation, saveInstanceTemplate, type InstanceTemplate } from '../components/magictemplate/instance-data';
import { TemplateAvailability, resolveAvailability, type TemplateAvailabilityValue } from '../components/magictemplate/template-availability';
import { MagicModal } from '../components/ui/magic-modal';
import { BackendConnectionCheck } from '../components/magictemplate/backend-connection-check';
import { Button, EmptyState, Icon, Input, Notice, PageHeader, Textarea } from '../components/ui/magic-ui';

export const Route = createFileRoute('/templates')({ component: TemplatesPage });

type Editor = { id: string | null; nome: string; conteudo: string; availability: TemplateAvailabilityValue };
type Feedback = { tone: 'success' | 'error'; text: string };

function countVariables(content: string) {
  return new Set(Array.from(content.matchAll(/\{\{\s*(\d+)\s*\}\}/g), match => String(Number(match[1])))).size;
}

function TemplatesPage() {
  const workspace = useSharedInstanceWorkspace();
  return <TemplatesContent key={workspace.userId} workspace={workspace} />;
}

function operationError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message;
  return 'Não foi possível concluir a operação.';
}

function TemplatesContent({ workspace }: { workspace: ReturnType<typeof useSharedInstanceWorkspace> }) {
  const { client, selection } = workspace;
  const [templates, setTemplates] = useState<InstanceTemplate[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importAvailability, setImportAvailability] = useState<TemplateAvailabilityValue>({ mode: 'specific', ids: [] });
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [formError, setFormError] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState<{ templateId: string; instanceId: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const editorPanel = useRef<HTMLElement>(null);
  const active = useRef(true);
  const writing = useRef(false);
  const loading = workspace.loading || libraryLoading || pending;
  const canWrite = !!client && !!workspace.userId && !loading && !libraryError && !workspace.error;
  const visible = templates.filter(item => `${item.nome ?? ''} ${item.conteudo}`.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR')));

  useEffect(() => {
    let current = true;
    setTemplates([]);
    setLibraryError('');
    if (!client || !workspace.userId || workspace.loading) {
      setLibraryLoading(false);
      return () => { current = false; };
    }
    setLibraryLoading(true);
    void loadTemplateLibrary(client, workspace.userId).then(rows => {
      if (current) setTemplates(rows);
    }).catch(cause => {
      if (current) setLibraryError(operationError(cause));
    }).finally(() => {
      if (current) setLibraryLoading(false);
    });
    return () => { current = false; };
  }, [client, workspace.userId, workspace.loading]);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  function openEditor(item?: InstanceTemplate) {
    if (!canWrite || writing.current) return;
    setEditor(item
      ? { id: item.id, nome: item.nome ?? '', conteudo: item.conteudo, availability: { mode: 'specific', ids: item.instanceIds } }
      : { id: null, nome: '', conteudo: '', availability: { mode: 'specific', ids: selection ? [selection.instanceId] : [] } });
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
    setUnlinking(null);
    setFeedback(null);
    setFormError('');
    try {
      await operation();
      if (!active.current) return;
      setEditor(null);
      setImporting(false);
      setDeleting(null);
      setSearch('');
      setFeedback({ tone: 'success', text: 'Alteração gravada. A biblioteca foi solicitada novamente ao banco.' });
    } catch (error) {
      if (!active.current) return;
      if (error instanceof CommittedWriteError) {
        setEditor(null);
        setImporting(false);
        setDeleting(null);
        setFeedback({ tone: 'error', text: operationError(error) });
      } else if (inEditor) setFormError(operationError(error));
      else {
        setImporting(false);
        setFeedback({ tone: 'error', text: operationError(error) });
      }
    } finally {
      // Manter o bloqueio até reler também a biblioteca, não só a instância selecionada.
      // Falhas parciais ou respostas perdidas nunca provocam reenvio automático.
      if (active.current) {
        setLibraryLoading(true);
        try {
          await workspace.refresh();
          if (active.current && client) {
            const rows = await loadTemplateLibrary(client, workspace.userId);
            if (active.current) {
              setTemplates(rows);
              setLibraryError('');
            }
          }
        } catch (cause) {
          if (active.current) {
            setTemplates([]);
            setLibraryError(`Não foi possível conferir a biblioteca após a operação. Recarregue antes de tentar novamente. ${operationError(cause)}`);
          }
        } finally {
          if (active.current) {
            setLibraryLoading(false);
            setPending(false);
          }
        }
      }
      writing.current = false;
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || !client || !workspace.userId || !canWrite) return;
    if (!editor.conteudo.trim()) {
      setFormError('Preencha o conteúdo do template. Espaços em branco não são suficientes.');
      return;
    }
    const input = { nome: editor.nome, conteudo: editor.conteudo };
    const ids = resolveAvailability(editor.availability, workspace.instances);
    void mutate(() => saveInstanceTemplate(client, workspace.userId, input, ids, editor.id ?? undefined), true);
  }

  function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !client || !workspace.userId || !canWrite) return;
    const ids = resolveAvailability(importAvailability, workspace.instances);
    void mutate(() => importInstanceTemplates(client, workspace.userId, file, ids));
  }

  function remove(id: string) {
    if (!client || !workspace.userId || !canWrite) return;
    void mutate(() => deleteInstanceTemplate(client, workspace.userId, id));
  }

  function unlink(templateId: string, instanceId: string) {
    if (!client || !workspace.userId || !canWrite) return;
    void mutate(() => removeTemplateAssociation(client, workspace.userId, templateId, instanceId));
  }

  return <MagicLayout active="/templates">
    <PageHeader title="Gerenciar Templates" description="Uma biblioteca por conta. Cadastre uma vez e associe seus templates às instâncias desejadas." actions={<><Button variant="secondary" disabled={!canWrite} onClick={() => { setImportAvailability({ mode: 'specific', ids: selection ? [selection.instanceId] : [] }); setImporting(true); }}><Icon name="upload" />Importar</Button><Button disabled={!canWrite} onClick={() => openEditor()}><Icon name="plus" />Adicionar Template</Button></>} />
    <section aria-labelledby="templates-instance-title" className="mb-6 space-y-4 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon name="template" /></span><div><h2 id="templates-instance-title" className="text-base font-semibold text-slate-900">Instâncias</h2><p className="mt-1 text-sm text-slate-500">A seleção prepara Gerar Mensagem e sugere a disponibilidade de novos templates. A biblioteca abaixo sempre mostra todos os seus templates.</p></div></div>
      <InstanceWorkspaceControls id="templates-instance" disabled={pending} />
      {workspace.error && <Notice tone="error">{workspace.error}</Notice>}
      {workspace.persistenceWarning && <Notice>{workspace.persistenceWarning}</Notice>}
      {client && workspace.error && <Button variant="secondary" disabled={loading} onClick={() => void workspace.refresh()}>Tentar novamente</Button>}
      <BackendConnectionCheck />
    </section>
    <input ref={fileInput} type="file" accept=".json,.txt,application/json,text/plain" className="hidden" aria-label="Importar templates em JSON ou TXT" onChange={importFile} />
    {unlinking && <MagicModal labelledBy="magic-unlink-title" onClose={() => { if (!writing.current) setUnlinking(null); }}>
      <section className="space-y-4 rounded-xl border border-blue-100 bg-background p-5 text-foreground">
        <h2 id="magic-unlink-title" className="text-lg font-semibold">Remover esta associação?</h2>
        <p className="text-sm leading-relaxed text-slate-600">O template <span className="font-semibold">{templates.find(item => item.id === unlinking.templateId)?.nome || 'Template sem nome'}</span> deixará de estar disponível em <span className="font-semibold">{workspace.instances.find(instance => instance.id === unlinking.instanceId)?.name || 'esta instância'}</span>. Ele continuará na biblioteca central e nas demais instâncias associadas.</p>
        <Notice>Esta ação remove somente o vínculo. O conteúdo do template não será excluído.</Notice>
        <div className="flex flex-wrap justify-end gap-2">
          <Button autoFocus variant="secondary" disabled={pending} onClick={() => setUnlinking(null)}>Cancelar</Button>
          <Button disabled={!canWrite} onClick={() => unlink(unlinking.templateId, unlinking.instanceId)}>Confirmar remoção da associação</Button>
        </div>
      </section>
    </MagicModal>}
    <div className="mb-6 space-y-3">
      <Notice>Biblioteca central da sua conta: editar um template atualiza o mesmo texto em todas as suas associações. Remover uma associação não exclui o template. A importação ignora IDs, proprietários e vínculos do arquivo.</Notice>
      <Notice>Cadastro e importação não exigem uma instância. Sem associações, o template permanece somente na biblioteca; sua disponibilidade em Gerar Mensagem depende dos vínculos selecionados.</Notice>
      {libraryError && <><Notice tone="error">{libraryError}</Notice><Button variant="secondary" disabled={loading} onClick={() => void workspace.refresh()}>Recarregar biblioteca</Button></>}
      {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}
    </div>
    {importing && <MagicModal labelledBy="magic-import-title" onClose={() => { if (!writing.current) setImporting(false); }}><section className="space-y-5 rounded-2xl bg-background p-5 text-foreground">
      <h2 id="magic-import-title" className="text-lg font-semibold">Importar para a biblioteca</h2>
      <p className="text-sm leading-relaxed text-slate-500">Cada objeto será cadastrado uma única vez, com as associações escolhidas abaixo. Selecionar várias instâncias não duplica o template.</p>
      <TemplateAvailability instances={workspace.instances} value={importAvailability} onChange={setImportAvailability} disabled={loading} />
      <Notice>Use JSON ou TXT de até 1 MB, com 1 a 100 templates. No JSON, informe uma lista de objetos contendo conteudo e, opcionalmente, nome. No TXT, cada bloco é um template; separe os blocos por uma linha contendo apenas ---. Linhas vazias dentro do texto são preservadas. Os nomes usam o nome do arquivo e a posição do bloco.</Notice>
      <div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" disabled={pending} onClick={() => setImporting(false)}>Cancelar</Button><Button disabled={!canWrite} onClick={() => fileInput.current?.click()}>{pending ? 'Importando…' : 'Escolher JSON ou TXT e importar'}</Button></div>
    </section></MagicModal>}
    {editor && <MagicModal labelledBy="magic-editor-title" onClose={() => { if (!writing.current) { setEditor(null); setFormError(''); } }}><section ref={editorPanel} aria-labelledby="magic-editor-title" className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 id="magic-editor-title" className="mb-5 text-lg font-semibold text-slate-900">{editor.id ? 'Editar Template' : 'Adicionar Template'}</h2>
      <form onSubmit={save} className="space-y-5">
        <div><label htmlFor="template-name" className="mb-2 block text-sm font-medium text-slate-700">Nome <span className="font-normal text-slate-400">(opcional)</span></label><Input id="template-name" disabled={loading} value={editor.nome} onChange={event => setEditor({ ...editor, nome: event.target.value })} placeholder="Dê um nome para identificar seu template" /></div>
        <div><label htmlFor="template-content" className="mb-2 block text-sm font-medium text-slate-700">Conteúdo <span className="text-blue-600">*</span></label><Textarea id="template-content" required disabled={loading} rows={6} value={editor.conteudo} aria-invalid={!!formError} aria-describedby={`template-content-help${formError ? ' template-form-error' : ''}`} onChange={event => { setEditor({ ...editor, conteudo: event.target.value }); setFormError(''); }} placeholder="Escreva o texto fixo e indique onde entram as variáveis…" /><div id="template-content-help" className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-500"><span>Use {'{{1}}'}, {'{{2}}'}, {'{{3}}'} para identificar as variáveis.</span><span>{countVariables(editor.conteudo)} variável(is) identificada(s)</span></div></div>
        <TemplateAvailability instances={workspace.instances} value={editor.availability} onChange={availability => setEditor({ ...editor, availability })} disabled={loading} />
        {editor.id && <Notice>Salvar substitui a disponibilidade pela seleção acima. Desmarcar todas as instâncias remove os vínculos, mas mantém o template na biblioteca.</Notice>}
        {formError && <div id="template-form-error"><Notice tone="error">{formError}</Notice></div>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button variant="secondary" disabled={pending} onClick={() => { setEditor(null); setFormError(''); }}>Cancelar</Button><Button type="submit" disabled={!canWrite}>{pending ? 'Salvando…' : 'Salvar'}</Button></div>
      </form>
    </section></MagicModal>}
    <section aria-label="Lista de templates" aria-busy={loading} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><h2 className="text-base font-semibold">Seus templates <span className="ml-2 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">{templates.length}</span></h2><div className="relative w-full sm:max-w-sm"><label htmlFor="template-search" className="sr-only">Buscar templates por nome ou conteúdo</label><span className="pointer-events-none absolute left-3 top-3 text-slate-400"><Icon name="search" /></span><Input id="template-search" type="search" className="pl-10" placeholder="Buscar templates…" value={search} onChange={event => setSearch(event.target.value)} /></div></div>
      {loading ? <div className="space-y-4"><Notice tone="loading">{pending ? 'Gravando alteração no banco…' : 'Carregando instâncias e templates…'}</Notice>{[0, 1].map(key => <div key={key} aria-hidden="true" className="h-32 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" />)}</div>
        : visible.length === 0 ? <EmptyState title={libraryError || workspace.error ? 'Biblioteca indisponível' : !workspace.userId ? 'Entre na sua conta' : templates.length ? 'Nenhum template encontrado' : 'Seu primeiro template começa aqui'} description={libraryError || workspace.error ? 'Confira o diagnóstico acima e tente recarregar a biblioteca.' : !workspace.userId ? 'A biblioteca pertence ao usuário autenticado.' : templates.length ? 'Tente buscar por outro nome ou por uma palavra do conteúdo.' : 'Cadastre uma vez e escolha em quais instâncias disponibilizar o template.'}>{templates.length ? <Button variant="secondary" onClick={() => setSearch('')}>Limpar busca</Button> : <Button disabled={!canWrite} onClick={() => openEditor()}><Icon name="plus" />Adicionar Template</Button>}</EmptyState>
        : <ul className="grid gap-4 md:grid-cols-2">{visible.map(item => <li key={item.id} className="flex min-w-0 flex-col rounded-xl border border-slate-200 p-5 transition hover:border-blue-200">
          <div className="flex items-start gap-3"><span className="rounded-lg bg-blue-50 p-2 text-blue-600"><Icon name="template" /></span><div className="min-w-0"><h3 className="break-words text-sm font-semibold text-slate-900">{item.nome || 'Template sem nome'}</h3><span className="mt-1 inline-block text-xs text-slate-500">{item.variaveis_count} {item.variaveis_count === 1 ? 'variável' : 'variáveis'}</span></div></div>
          <p className="my-4 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-500">{item.conteudo}</p>
          <div className="mb-4 space-y-2 rounded-lg bg-slate-50 p-3"><h4 className="text-xs font-semibold text-slate-700">Disponível em {item.instanceIds.length} instância(s)</h4>{item.instanceIds.length ? <ul className="space-y-2">{item.instanceIds.map(instanceId => <li key={instanceId} className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600"><span>{workspace.instances.find(instance => instance.id === instanceId)?.name ?? 'Instância vinculada'}</span><button type="button" disabled={!canWrite} onClick={() => setUnlinking({ templateId: item.id, instanceId })} aria-label={`Remover associação de ${item.nome || 'template'} com ${workspace.instances.find(instance => instance.id === instanceId)?.name ?? 'instância'}`} className="rounded-md px-2 py-1 font-medium text-blue-700 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50">Remover associação</button></li>)}</ul> : <p className="text-xs leading-relaxed text-slate-500">Somente na biblioteca. Este template não aparece em Gerar Mensagem.</p>}</div>
          <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3"><Button variant="secondary" disabled={!canWrite} onClick={() => openEditor(item)} aria-label={`Editar ${item.nome || 'template sem nome'}`}><Icon name="edit" />Editar e associações</Button><Button variant="secondary" disabled={!canWrite} onClick={() => setDeleting(item.id)} aria-label={`Excluir ${item.nome || 'template sem nome'}`}><Icon name="trash" />Excluir da biblioteca</Button></div>
          {deleting === item.id && <MagicModal labelledBy="magic-delete-title" onClose={() => { if (!writing.current) setDeleting(null); }}><div className="rounded-xl border border-red-100 bg-red-50 p-5"><h2 id="magic-delete-title" className="text-lg font-semibold text-red-800">Excluir este template?</h2><p className="mt-2 text-sm text-red-700">{item.nome || 'Template sem nome'} será excluído da biblioteca e de todas as instâncias associadas. Para retirar apenas de uma instância, cancele e use Remover associação. Esta exclusão não pode ser desfeita.</p><div className="mt-5 flex flex-wrap justify-end gap-2"><Button autoFocus variant="secondary" disabled={pending} onClick={() => setDeleting(null)}>Cancelar</Button><Button variant="danger" disabled={!canWrite} onClick={() => remove(item.id)}>Confirmar exclusão</Button></div></div></MagicModal>}
        </li>)}</ul>}
      <p className="mt-5 text-xs leading-relaxed text-slate-400">Importação: JSON ou TXT de até 1 MB e 100 templates. JSON usa uma lista com conteudo obrigatório e nome opcional. TXT usa blocos separados por uma linha contendo apenas ---. As variáveis são contadas automaticamente. Se houver falha de confirmação, confira a biblioteca antes de importar novamente.</p>
    </section>
  </MagicLayout>;
}
