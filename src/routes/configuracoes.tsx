import { createFileRoute } from '@tanstack/react-router';
import { MagicLayout } from '../components/magictemplate/layout';
import { Icon, PageHeader } from '../components/ui/magic-ui';

export const Route = createFileRoute('/configuracoes')({ component: SettingsPage });

function SettingsPage() {
  return <MagicLayout active="/configuracoes">
    <PageHeader title="Configurações" description="Um espaço para as futuras preferências do MAGICtemplate." />
    <section aria-labelledby="magic-settings-title" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-5"><span className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><Icon name="settings" /></span><div><h2 id="magic-settings-title" className="text-base font-semibold text-slate-900">Preferências do aplicativo</h2><p className="mt-1 text-sm text-slate-500">Simples, organizado e no seu ritmo.</p></div></div>
      <div className="flex flex-col items-center px-6 py-16 text-center sm:py-20"><span className="mb-5 rounded-2xl border border-slate-100 bg-slate-50 p-5 text-slate-400"><Icon name="settings" className="h-8 w-8" /></span><span className="mb-3 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Em breve</span><h3 className="text-xl font-semibold tracking-tight text-slate-800">Tudo no seu lugar</h3><p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500">As opções de personalização do MAGICtemplate estarão reunidas aqui. Nenhuma configuração é necessária nesta etapa.</p></div>
      <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-4 text-center text-xs leading-relaxed text-slate-500">Não é necessário informar chaves externas de API.</div>
    </section>
  </MagicLayout>;
}
