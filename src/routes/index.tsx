import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { MagicLayout } from '../components/magictemplate/layout';
import { InstanceSelector, useSharedInstanceWorkspace } from '../components/magictemplate/instance-controls';
import { VariableResults } from '../components/magictemplate/variable-results';
import { BackendConnectionCheck } from '../components/magictemplate/backend-connection-check';
import { Button, Icon, Notice, PageHeader, Textarea } from '../components/ui/magic-ui';

export const Route = createFileRoute('/')({ component: GeneratePage });

function GeneratePage() {
  const workspace = useSharedInstanceWorkspace();
  return <GenerateContent key={`${workspace.userId}:${workspace.selection?.instanceId ?? ''}`} workspace={workspace} />;
}

function GenerateContent({ workspace }: { workspace: ReturnType<typeof useSharedInstanceWorkspace> }) {
  const [mode, setMode] = useState<'idea' | 'message'>('idea');
  const [drafts, setDrafts] = useState({ idea: '', message: '' });
  const { templates, instances, selection, loading, error, persistenceWarning, selectInstance } = workspace;
  const [selectedId, setSelectedId] = useState('');
  const [complements, setComplements] = useState<Record<string, string>>({});
  const selected = templates.find(item => item.id === selectedId);
  const variables = selected ? [...new Set(Array.from(selected.conteudo.matchAll(/\{\{\s*(\d+)\s*\}\}/g), match => String(Number(match[1]))))] : [];
  const items = variables.map(id => ({ id, value: complements[id] ?? '' }));

  return <MagicLayout active="/">
    <PageHeader title="Gerar Mensagem" description="Transforme sua intenção em complementos para cada variável do seu template." />
    <section aria-labelledby="generate-instance-title" className="mb-6 space-y-4 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon name="template" /></span><div><h2 id="generate-instance-title" className="text-base font-semibold text-slate-900">Instância e template</h2><p className="mt-1 text-sm text-slate-500">Escolha a instância antes de selecionar o template da mensagem.</p></div></div>
      <InstanceSelector id="generate-instance" instances={instances} value={selection?.instanceId ?? ''} loading={loading} disabled={!workspace.client || !workspace.userId} onChange={id => { setSelectedId(''); setComplements({}); setDrafts({ idea: '', message: '' }); selectInstance(id); }} />
      {error && <Notice tone="error">{error}</Notice>}
      {persistenceWarning && <Notice>{persistenceWarning}</Notice>}
      {workspace.client && error && <Button variant="secondary" disabled={loading} onClick={() => void workspace.refresh()}>Tentar novamente</Button>}
      <BackendConnectionCheck />
      <div>
        <label htmlFor="magic-template" className="mb-2 block text-sm font-medium text-slate-700">Template</label>
        <select id="magic-template" disabled={!selection || loading} value={selectedId} onChange={event => { setSelectedId(event.target.value); setComplements({}); }} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400">
          <option value="">Selecione um template</option>
          {templates.map(item => <option key={item.id} value={item.id}>{item.nome || 'Template sem nome'}</option>)}
        </select>
      </div>
      <Notice>{loading ? 'Carregando instâncias e templates…' : !selection ? 'Selecione uma instância para acessar seus templates. Crie e gerencie instâncias na tela Templates.' : templates.length ? 'Os templates são consultados no banco. Preencha os complementos manualmente; eles não são gerados nem salvos. Trocar a instância ou o template limpa os complementos.' : 'Esta instância ainda não possui templates. Adicione ou importe templates na tela Templates.'}</Notice>
      {selected && <div className="rounded-xl bg-slate-50 p-4"><h2 className="text-sm font-semibold text-slate-700">Texto do template</h2><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-500">{selected.conteudo}</p>{variables.length === 0 && <p className="mt-3 text-xs text-slate-500">Este template não contém variáveis numéricas para preencher.</p>}</div>}
    </section>
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <section aria-labelledby="magic-input-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon name="message" /></span><h2 id="magic-input-title" className="text-base font-semibold">O que você quer comunicar?</h2></div>
        <div role="group" aria-label="Tipo de entrada" className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          {([{ value: 'idea', label: 'Ideia ou intenção' }, { value: 'message', label: 'Mensagem pronta' }] as const).map(option => <button key={option.value} type="button" aria-pressed={mode === option.value} onClick={() => setMode(option.value)} className={`min-h-11 rounded-lg px-2 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${mode === option.value ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{option.label}</button>)}
        </div>
        <label htmlFor="magic-draft" className="mb-2 block text-sm font-medium text-slate-700">{mode === 'idea' ? 'Descreva sua ideia ou intenção' : 'Insira sua mensagem pronta'}</label>
        <Textarea id="magic-draft" rows={9} value={drafts[mode]} onChange={event => setDrafts(current => ({ ...current, [mode]: event.target.value }))} placeholder={mode === 'idea' ? 'Descreva o objetivo, o público e os detalhes importantes da sua mensagem…' : 'Cole a mensagem que deseja adaptar…'} aria-describedby="magic-processing-note" />
        <p className="mt-2 text-right text-xs text-slate-400">{drafts[mode].length} caracteres</p>
        <Button disabled className="mt-5 w-full" aria-describedby="magic-processing-note"><Icon name="spark" />Processar</Button>
        <div id="magic-processing-note" className="mt-4"><Notice>O processamento será disponibilizado em uma próxima etapa. Esta interface não envia seu texto e não gera respostas de demonstração.</Notice></div>
      </section>
      <VariableResults key={selectedId} items={items} onChange={(id, value) => setComplements(current => ({ ...current, [id]: value }))} />
    </div>
    <div className="mt-6 flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500"><span className="mt-0.5 text-blue-500"><Icon name="template" /></span><p className="leading-relaxed">Textos fixos permanecem no template. Cada complemento será apresentado separadamente, com edição e cópia individuais.</p></div>
  </MagicLayout>;
}
