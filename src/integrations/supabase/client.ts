import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const configurationHelp = 'Verifique no Lovable Cloud a disponibilização da configuração pública do backend gerenciado ao build deste aplicativo. Após corrigir os valores, gere uma nova versão do aplicativo. Não é necessário conectar outro projeto.';

function initializeClient(): { client: SupabaseClient | null; error: string } {
  // O Vite incorpora estas variáveis públicas durante o build.
  // Não há descoberta de credenciais por sessão nem conexão alternativa.
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
    || import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  const missing: string[] = [];
  if (!url) missing.push('VITE_SUPABASE_URL');
  if (!key) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY)');
  if (missing.length) {
    return { client: null, error: `Configuração pública ausente neste build: ${missing.join(', ')}. ${configurationHelp}` };
  }

  try {
    const parsedUrl = new URL(url!);
    if (!['https:', 'http:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
      return { client: null, error: `VITE_SUPABASE_URL possui formato inválido. ${configurationHelp}` };
    }
  } catch {
    return { client: null, error: `VITE_SUPABASE_URL possui formato inválido. ${configurationHelp}` };
  }

  try {
    return {
      client: createClient(url!, key!, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }),
      error: '',
    };
  } catch {
    // Não expor valores de configuração nem credenciais em mensagens.
    return { client: null, error: `Não foi possível inicializar o cliente com a configuração pública deste build. ${configurationHelp}` };
  }
}

// Todos os consumidores reutilizam o mesmo cliente e a sessão do SDK.
const initialized = initializeClient();
export const supabase = initialized.client;
export const supabaseConfigurationError = initialized.error;

export async function verifyBackendReads(): Promise<string[]> {
  const client = supabase;
  if (!client) throw new Error(supabaseConfigurationError);

  const sessionResult = await client.auth.getSession();
  if (sessionResult.error || !sessionResult.data.session) {
    throw new Error('A verificação requer uma sessão autenticada válida neste aplicativo. Nenhuma consulta às tabelas foi executada.');
  }
  const userId = sessionResult.data.session.user.id;
  const userResult = await client.auth.getUser();
  if (userResult.error || userResult.data.user?.id !== userId) {
    throw new Error('Não foi possível validar o usuário no backend. Verifique a sessão e a disponibilidade do serviço de autenticação. Nenhuma consulta às tabelas foi executada.');
  }

  const results = ['Usuário autenticado validado pelo backend.'];
  // Leituras mínimas e independentes: templates é consultada mesmo sem instâncias visíveis.
  // Nenhum conteúdo, token ou identificador é incluído no relatório.
  for (const table of ['instances', 'templates'] as const) {
    try {
      const { data, error, status } = await client.schema('public').from(table)
        .select('id').eq('user_id', userId).limit(1);
      if (error) {
        const hint = status === 401
          ? 'A requisição não foi autorizada; verifique a sessão e a configuração pública do backend.'
          : status === 403
            ? 'O backend recusou o acesso com as permissões atuais.'
            : 'A leitura não foi concluída. Verifique a disponibilidade e a configuração do backend.';
        results.push(`public.${table}: falha de leitura (HTTP ${status || 'indisponível'}). ${hint}`);
      } else {
        results.push(`public.${table}: leitura concluída (HTTP ${status}), ${data?.length ? 'com registro visível' : 'sem registros visíveis'}. Consulta limitada a 1 registro do usuário atual, sujeita às políticas RLS existentes.`);
      }
    } catch {
      results.push(`public.${table}: leitura não concluída; nenhuma resposta válida foi obtida.`);
    }
  }

  const current = await client.auth.getSession();
  if (current.error || current.data.session?.user.id !== userId) {
    throw new Error('A sessão mudou durante a verificação. Execute novamente com a conta atual.');
  }
  results.push('Uma resposta vazia pode decorrer dos filtros ou da RLS; não comprova que a tabela esteja vazia. Nenhum registro ou política foi alterado por esta verificação.');
  return results;
}
