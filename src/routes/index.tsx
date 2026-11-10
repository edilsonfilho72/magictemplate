import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { MagicLayout } from '../components/magictemplate/layout';
import { VariableResults } from '../components/magictemplate/variable-results';
import { Button, Icon, Notice, PageHeader, Textarea } from '../components/ui/magic-ui';

export const Route = createFileRoute('/')({ component: GeneratePage });

function GeneratePage() {
  const [mode, setMode] = useState<'idea' | 'message'>('idea');
  const [drafts, setDrafts] = useState({ idea: '', message: '' });

  return <MagicLayout active="/">
    <PageHeader title="Gerar Mensagem" description="Transforme sua intenção em complementos para cada variável do seu template." />
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
      <VariableResults items={[]} onChange={() => undefined} />
    </div>
    <div className="mt-6 flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500"><span className="mt-0.5 text-blue-500"><Icon name="template" /></span><p className="leading-relaxed">Textos fixos permanecem no template. Cada complemento será apresentado separadamente, com edição e cópia individuais.</p></div>
  </MagicLayout>;
}
