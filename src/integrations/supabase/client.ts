import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const configurationMessage = 'A configuração pública do Supabase está ausente ou inválida. Conecte o projeto Supabase existente pela integração do Lovable para disponibilizar VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY ou VITE_SUPABASE_ANON_KEY.';

function initializeClient(): { client: SupabaseClient | null; error: string } {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
    || import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!url || !key) return { client: null, error: configurationMessage };

  try {
    const parsedUrl = new URL(url);
    if (!['https:', 'http:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
      return { client: null, error: configurationMessage };
    }

    return {
      client: createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }),
      error: '',
    };
  } catch {
    // Não expor URLs, chaves ou detalhes de configuração em mensagens de erro.
    return { client: null, error: configurationMessage };
  }
}

// Inicialização única por módulo. Todos os consumidores reutilizam esta instância
// e a sessão mantida pelo SDK, sem armazenamento paralelo de autenticação.
const initialized = initializeClient();
export const supabase = initialized.client;
export const supabaseConfigurationError = initialized.error;
