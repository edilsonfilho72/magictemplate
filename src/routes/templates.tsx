import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { MagicLayout } from '../components/magictemplate/layout';
import { Button, EmptyState, Icon, Input, Notice, PageHeader, Textarea } from '../components/ui/magic-ui';

export const Route = createFileRoute('/templates')({ component: TemplatesPage });

type TemplateDraft = { id: string; nome: string; conteudo: string; variaveis_count: number };
type Editor = { id: string | null; nome: string; conteudo: string };
type Feedback = { tone: 'success' | 'error'; text: string };

function countVariables(content: string) {
  return new Set(Array.from(content.matchAll(/\{\{\s*(\d+)\s*\}\}/g), match => String(Number(match[1])))).size;
}

function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateDraft[]>([]);
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [formError, setFormError] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const editorPanel = useRef<HTMLElement>(null);
  const sequence = useRef(0);
  const visible = templates.filter(item => `${item.nome} ${item.conteudo}`.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR')));

  function newId() {
    sequence.current += 1;
    return `draft-${sequence.current}`;
  }

  function openEditor(item?: TemplateDraft) {
    setEditor(item ? { id: item.id, nome: item.nome, conteudo: item.conteudo } : { id: null, nome: '', conteudo: '' });
    setFormError('');
    setFeedback(null);
    setDeleting(null);
    requestAnimationFrame(() => {
      editorPanel.current?.scrollIntoView({ block: 'nearest' });
      editorPanel.current?.querySelector<HTMLInputElement>('input')?.focus();
    });
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    if (!editor.conteudo.trim()) {
      setFormError('Preencha o conteúdo do template. Espaços em branco não são suficientes.');
      return;
    }
    const item: TemplateDraft = { id: editor.id ?? newId(), nome: editor.nome.trim(), conteudo: editor.conteudo, variaveis_count: countVariables(editor.conteudo) };
    setTemplates(current => editor.id ? current.map(existing => existing.id === editor.id ? item : existing) : [item, ...current]);
    setEditor(null);
    setSearch('');
    setFeedback({ tone: 'success', text: 'Template salvo na prévia desta tela. Nenhum dado foi gravado no banco.' });
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setFeedback(null);
    setLoading(true);
    try {
      if (file.size > 1024 * 1024) throw new Error('Escolha um arquivo JSON de até 1 MB.');
      const parsed: unknown = JSON.parse(await file.text());
      if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 100) throw new Error('O arquivo deve conter uma lista de 1 a 100 templates.');
      const imported = parsed.map((value: unknown, index): TemplateDraft => {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`O template ${index + 1} é inválido.`);
        const row = value as Record<string, unknown>;
        if (typeof row.conteudo !== 'string' || !row.conteudo.trim()) throw new Error(`O template ${index + 1} precisa de conteúdo.`);
        if (row.nome != null && typeof row.nome !== 'string') throw new Error(`O nome do template ${index + 1} deve ser um texto.`);
        return { id: newId(), nome: typeof row.nome === 'string' ? row.nome.trim() : '', conteudo: row.conteudo, variaveis_count: countVariables(row.conteudo) };
      });
      setTemplates(current => [...imported, ...current]);
      setSearch('');
      setFeedback({ tone: 'success', text: `${imported.length} template(s) importado(s) na prévia. Nenhum dado foi gravado no banco.` });
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof SyntaxError ? 'O arquivo não contém JSON válido.' : error instanceof Error ? error.message : 'Não foi possível importar o arquivo.' });
    } finally {
      setLoading(false);
    }
  }

  function remove(id: string) {
    setTemplates(current => current.filter(item => item.id !== id));
    if (editor?.id === id) setEditor(null);
    setDeleting(null);
    setFeedback({ tone: 'success', text: 'Template removido da prévia. O banco de dados não foi alterado.' });
  }

  return <MagicLayout active="/templates">
    <PageHeader title="Gerenciar Templates" description="Organize os textos fixos e as variáveis das suas mensagens." actions={<><Button variant="secondary" disabled={loading} onClick={() => fileInput.current?.click()}><Icon name="upload" />Importar</Button><Button onClick={() => openEditor()}><Icon name="plus" />Adicionar Template</Button></>} />
    <input ref={fileInput} type="file" accept=".json,application/json" className="hidden" aria-label="Importar templates em JSON" onChange={importFile} />
    <div className="mb-6 space-y-3">
      <Notice>Prévia visual: os templates ficam apenas na memória desta tela e são descartados ao sair ou recarregar. Os templates do banco não são consultados nem alterados nesta etapa.</Notice>
      {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}
    </div>
    {editor && <section ref={editorPanel} aria-labelledby="magic-editor-title" className="mb-6 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 id="magic-editor-title" className="mb-5 text-lg font-semibold text-slate-900">{editor.id ? 'Editar Template' : 'Adicionar Template'}</h2>
      <form onSubmit={save} className="space-y-5">
        <div><label htmlFor="template-name" className="mb-2 block text-sm font-medium text-slate-700">Nome <span className="font-normal text-slate-400">(opcional)</span></label><Input id="template-name" value={editor.nome} onChange={event => setEditor({ ...editor, nome: event.target.value })} placeholder="Dê um nome para identificar seu template" /></div>
        <div><label htmlFor="template-content" className="mb-2 block text-sm font-medium text-slate-700">Conteúdo <span className="text-blue-600">*</span></label><Textarea id="template-content" required rows={6} value={editor.conteudo} aria-invalid={!!formError} aria-describedby={`template-content-help${formError ? ' template-form-error' : ''}`} onChange={event => { setEditor({ ...editor, conteudo: event.target.value }); setFormError(''); }} placeholder="Escreva o texto fixo e indique onde entram as variáveis…" /><div id="template-content-help" className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-500"><span>Use {'{{1}}'}, {'{{2}}'}, {'{{3}}'} para identificar as variáveis.</span><span>{countVariables(editor.conteudo)} variável(is) identificada(s)</span></div></div>
        {formError && <div id="template-form-error"><Notice tone="error">{formError}</Notice></div>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button variant="secondary" onClick={() => { setEditor(null); setFormError(''); }}>Cancelar</Button><Button type="submit">Salvar</Button></div>
      </form>
    </section>}
    <section aria-label="Lista de templates" aria-busy={loading} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><h2 className="text-base font-semibold">Seus templates <span className="ml-2 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">{templates.length}</span></h2><div className="relative w-full sm:max-w-sm"><label htmlFor="template-search" className="sr-only">Buscar templates por nome ou conteúdo</label><span className="pointer-events-none absolute left-3 top-3 text-slate-400"><Icon name="search" /></span><Input id="template-search" type="search" className="pl-10" placeholder="Buscar templates…" value={search} onChange={event => setSearch(event.target.value)} /></div></div>
      {loading ? <div className="space-y-4"><Notice tone="loading">Lendo e validando o arquivo…</Notice>{[0, 1].map(key => <div key={key} aria-hidden="true" className="h-32 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" />)}</div>
        : visible.length === 0 ? <EmptyState title={templates.length ? 'Nenhum template encontrado' : 'Seu primeiro template começa aqui'} description={templates.length ? 'Tente buscar por outro nome ou por uma palavra do conteúdo.' : 'Adicione um template para organizar seus textos e identificar suas variáveis.'}>{templates.length ? <Button variant="secondary" onClick={() => setSearch('')}>Limpar busca</Button> : <Button onClick={() => openEditor()}><Icon name="plus" />Adicionar Template</Button>}</EmptyState>
        : <ul className="grid gap-4 md:grid-cols-2">{visible.map(item => <li key={item.id} className="flex min-w-0 flex-col rounded-xl border border-slate-200 p-5 transition hover:border-blue-200">
          <div className="flex items-start gap-3"><span className="rounded-lg bg-blue-50 p-2 text-blue-600"><Icon name="template" /></span><div className="min-w-0"><h3 className="break-words text-sm font-semibold text-slate-900">{item.nome || 'Template sem nome'}</h3><span className="mt-1 inline-block text-xs text-slate-500">{item.variaveis_count} {item.variaveis_count === 1 ? 'variável' : 'variáveis'}</span></div></div>
          <p className="my-4 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-500">{item.conteudo}</p>
          <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3"><Button variant="secondary" onClick={() => openEditor(item)} aria-label={`Editar ${item.nome || 'template sem nome'}`}><Icon name="edit" />Editar</Button><Button variant="secondary" onClick={() => setDeleting(item.id)} aria-label={`Excluir ${item.nome || 'template sem nome'}`}><Icon name="trash" />Excluir</Button></div>
          {deleting === item.id && <div className="mt-3 rounded-lg border border-red-100 bg-red-50 p-3"><p className="text-sm text-red-800">Excluir este template da prévia?</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setDeleting(null)}>Cancelar</Button><Button variant="danger" onClick={() => remove(item.id)}>Confirmar exclusão</Button></div></div>}
        </li>)}</ul>}
      <p className="mt-5 text-xs leading-relaxed text-slate-400">Importação: arquivo JSON de até 1 MB, com uma lista de até 100 objetos contendo conteudo obrigatório e nome opcional. As variáveis são contadas automaticamente.</p>
    </section>
  </MagicLayout>;
}
