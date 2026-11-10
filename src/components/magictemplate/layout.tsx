import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { Icon, type IconName } from '../ui/magic-ui';

const navigation: { to: '/' | '/templates' | '/configuracoes'; label: string; icon: IconName }[] = [
  { to: '/', label: 'Gerar Mensagem', icon: 'message' },
  { to: '/templates', label: 'Templates', icon: 'template' },
  { to: '/configuracoes', label: 'Configurações', icon: 'settings' },
];

export function MagicLayout({ active, children }: { active: '/' | '/templates' | '/configuracoes'; children: ReactNode }) {
  return <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased lg:flex">
    <a href="#magic-content" className="sr-only z-50 rounded-lg bg-white px-4 py-3 text-blue-700 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Pular para o conteúdo</a>
    <aside className="border-b border-slate-200 bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col lg:border-b-0 lg:border-r">
      <Link to="/" aria-label="MAGICtemplate — início" className="flex items-center gap-3 px-6 py-7 focus-visible:outline-blue-500">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm"><Icon name="spark" /></span>
        <span className="text-lg tracking-tight"><span className="font-extrabold">MAGIC</span><span className="font-medium text-blue-600">template</span></span>
      </Link>
      <div className="hidden px-6 pb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 lg:block">Seu espaço de criação</div>
      <nav aria-label="Navegação principal" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:gap-2 lg:px-4">
        {navigation.map(item => <Link key={item.to} to={item.to} aria-current={active === item.to ? 'page' : undefined} className={`flex min-h-12 shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${active === item.to ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
          <Icon name={item.icon} />{item.label}
        </Link>)}
      </nav>
      <div className="mt-auto hidden p-5 lg:block"><div className="rounded-xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-600">Clareza em cada mensagem.</p><p className="mt-1 text-xs leading-relaxed text-slate-400">Um espaço simples para organizar seus templates.</p></div></div>
    </aside>
    <div className="min-w-0 flex-1 lg:pl-64">
      <div className="flex h-14 items-center justify-between border-b border-slate-200/80 bg-white px-5 sm:px-8"><span className="text-xs font-medium text-slate-400">Workspace / <span className="text-slate-600">{navigation.find(item => item.to === active)?.label}</span></span><span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700">Interface</span></div>
      <main id="magic-content" tabIndex={-1} className="mx-auto max-w-6xl px-5 py-8 outline-none sm:px-8 sm:py-10">{children}</main>
      <footer className="mx-auto max-w-6xl px-5 pb-6 text-xs text-slate-400 sm:px-8">MAGICtemplate · Cada variável, uma possibilidade.</footer>
    </div>
  </div>;
}
