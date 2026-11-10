import { createRootRoute, Link, Outlet } from '@tanstack/react-router';
import { InstanceWorkspaceProvider } from '../components/magictemplate/instance-controls';
import { supabase, supabaseConfigurationError } from '../integrations/supabase/client';

export const Route = createRootRoute({
  component: Root,
  notFoundComponent: NotFound,
});

function Root() {
  return <InstanceWorkspaceProvider client={supabase} configurationError={supabaseConfigurationError}><Outlet /></InstanceWorkspaceProvider>;
}

function NotFound() {
  return <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
    <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <p className="text-sm font-bold text-blue-600">MAGICtemplate</p>
      <h1 className="mt-4 text-2xl font-bold">Página não encontrada</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-500">Volte ao início para acessar suas telas.</p>
      <Link to="/" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">Gerar Mensagem</Link>
    </section>
  </main>;
}
