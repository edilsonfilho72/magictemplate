import type { SupabaseClient } from '@supabase/supabase-js';

export type Instance = {
  id: string;
  user_id: string;
  name: string;
  created_at: string | null;
  updated_at: string | null;
};

export type InstanceWithCount = Instance & { templateCount: number };
export type InstanceSelection = { userId: string; instanceId: string };
export type InstanceTemplate = {
  id: string;
  user_id: string;
  instance_id: string;
  nome: string | null;
  conteudo: string;
  variaveis_count: number;
  created_at: string;
  updated_at: string;
};
export type InstanceTemplateInput = { nome?: string | null; conteudo: string };

const instanceColumns = 'id,user_id,name,created_at,updated_at';
const templateColumns = 'id,user_id,instance_id,nome,conteudo,variaveis_count,created_at,updated_at';

async function requireUser(client: SupabaseClient, expectedUserId?: string) {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Entre na sua conta para gerenciar instâncias e templates.');
  if (expectedUserId && expectedUserId !== userId) {
    throw new Error('A conta foi alterada. Selecione novamente uma instância.');
  }
  return userId;
}

function instanceName(name: string) {
  const normalized = name.trim();
  if (!normalized) throw new Error('Informe o nome da instância.');
  return normalized;
}

async function requireSelection(client: SupabaseClient, selection: InstanceSelection) {
  const userId = await requireUser(client, selection.userId);
  if (!selection.instanceId) throw new Error('Selecione uma instância.');
  const { data, error } = await client.from('instances').select('id')
    .eq('id', selection.instanceId).eq('user_id', userId).single();
  if (error) throw error;
  if (!data) throw new Error('A instância selecionada não está disponível.');
  return userId;
}

async function templateCount(client: SupabaseClient, userId: string, instanceId: string) {
  const { count, error } = await client.from('templates')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId).eq('instance_id', instanceId);
  if (error) throw error;
  if (count === null) throw new Error('Não foi possível verificar a quantidade de templates.');
  return count;
}

export async function loadInstances(client: SupabaseClient) {
  const userId = await requireUser(client);
  const instances: Instance[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.from('instances').select(instanceColumns)
      .eq('user_id', userId).order('created_at').order('id').range(offset, offset + 99);
    if (error) throw error;
    const page = (data ?? []) as Instance[];
    instances.push(...page);
    if (page.length < 100) break;
  }
  const rows: InstanceWithCount[] = [];
  for (const instance of instances) {
    rows.push({ ...instance, templateCount: await templateCount(client, userId, instance.id) });
  }
  await requireUser(client, userId);
  return { userId, instances: rows };
}

export async function createInstance(client: SupabaseClient, expectedUserId: string, name: string) {
  const userId = await requireUser(client, expectedUserId);
  const { data, error } = await client.from('instances')
    .insert({ user_id: userId, name: instanceName(name) }).select(instanceColumns).single();
  if (error) throw error;
  return data as Instance;
}

export async function renameInstance(client: SupabaseClient, selection: InstanceSelection, name: string) {
  const userId = await requireSelection(client, selection);
  const { data, error } = await client.from('instances').update({ name: instanceName(name) })
    .eq('id', selection.instanceId).eq('user_id', userId).select(instanceColumns).single();
  if (error) throw error;
  return data as Instance;
}

export async function deleteEmptyInstance(client: SupabaseClient, selection: InstanceSelection) {
  const userId = await requireSelection(client, selection);
  if (await templateCount(client, userId, selection.instanceId) !== 0) {
    throw new Error('Esta instância contém templates e não pode ser excluída.');
  }
  // A verificação é preventiva. Uma FK restritiva no banco deve proteger
  // contra a inclusão concorrente de templates entre a contagem e a exclusão.
  const { data, error } = await client.from('instances').delete()
    .eq('id', selection.instanceId).eq('user_id', userId).select('id').single();
  if (error?.code === '23503') throw new Error('A instância possui registros vinculados e não pode ser excluída.');
  if (error) throw error;
  if (!data) throw new Error('A instância não foi excluída. Atualize a lista e tente novamente.');
}

export async function loadInstanceTemplates(client: SupabaseClient, selection: InstanceSelection) {
  const userId = await requireSelection(client, selection);
  const templates: InstanceTemplate[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.from('templates').select(templateColumns)
      .eq('user_id', userId).eq('instance_id', selection.instanceId)
      .order('created_at', { ascending: false }).order('id').range(offset, offset + 99);
    if (error) throw error;
    const page = (data ?? []) as InstanceTemplate[];
    templates.push(...page);
    if (page.length < 100) break;
  }
  await requireUser(client, userId);
  return templates;
}

function templateValues(value: unknown, index?: number) {
  const label = index === undefined ? 'O template' : `O template ${index + 1}`;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} é inválido.`);
  }
  const row = value as Record<string, unknown>;
  if (typeof row.conteudo !== 'string' || !row.conteudo.trim()) {
    throw new Error(`${label} precisa de conteúdo.`);
  }
  if (row.nome != null && typeof row.nome !== 'string') {
    throw new Error(`${label} precisa de um nome em formato de texto.`);
  }
  return {
    nome: typeof row.nome === 'string' ? row.nome.trim() : null,
    conteudo: row.conteudo,
    variaveis_count: new Set(Array.from(row.conteudo.matchAll(/\{\{\s*(\d+)\s*\}\}/g), match => String(Number(match[1])))).size,
  };
}

export async function saveInstanceTemplate(
  client: SupabaseClient,
  selection: InstanceSelection,
  input: InstanceTemplateInput,
  templateId?: string,
) {
  const userId = await requireSelection(client, selection);
  const values = templateValues(input);
  const query = templateId
    ? client.from('templates').update(values).eq('id', templateId)
      .eq('user_id', userId).eq('instance_id', selection.instanceId)
    : client.from('templates').insert({ ...values, user_id: userId, instance_id: selection.instanceId });
  const { data, error } = await query.select(templateColumns).single();
  if (error) throw error;
  return data as InstanceTemplate;
}

export async function importInstanceTemplates(client: SupabaseClient, selection: InstanceSelection, file: File) {
  if (file.size > 1024 * 1024) throw new Error('Escolha um arquivo JSON de até 1 MB.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('O arquivo não contém JSON válido.');
    throw error;
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 100) {
    throw new Error('O arquivo deve conter uma lista de 1 a 100 templates.');
  }
  // IDs e proprietários provenientes do arquivo nunca são usados.
  const values = parsed.map((value, index) => templateValues(value, index));
  const userId = await requireSelection(client, selection);
  const { error } = await client.from('templates').insert(values.map(value => ({
    ...value,
    user_id: userId,
    instance_id: selection.instanceId,
  })));
  if (error) throw error;
  return values.length;
}

export async function deleteInstanceTemplate(client: SupabaseClient, selection: InstanceSelection, templateId: string) {
  const userId = await requireSelection(client, selection);
  const { error } = await client.from('templates').delete().eq('id', templateId)
    .eq('user_id', userId).eq('instance_id', selection.instanceId).select('id').single();
  if (error) throw error;
}
