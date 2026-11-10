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
  instanceIds: string[];
  nome: string | null;
  conteudo: string;
  variaveis_count: number;
  created_at: string;
  updated_at: string;
};
export type InstanceTemplateInput = { nome?: string | null; conteudo: string };

const instanceColumns = 'id,user_id,name,created_at,updated_at';
const templateColumns = 'id,user_id,nome,conteudo,variaveis_count,created_at,updated_at,template_instances(instance_id)';

// As escritas em tabelas diferentes não são uma transação REST.
// Uma gravação parcial deve ser apresentada e relida, nunca repetida como cadastro novo.
export class CommittedWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommittedWriteError';
  }
}

function failureText(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) return String(error.message);
  return 'Não foi possível concluir a operação.';
}

function checkTemplateInsertError(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (error.code === '23502' && error.message.includes('instance_id')) {
    throw new Error('O banco ainda exige o vínculo antigo templates.instance_id. Conclua a validação da migração para liberar cadastro e importação na biblioteca central. Nenhum template foi criado por esta operação.');
  }
  throw error;
}

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
  const { count, error } = await client.from('template_instances')
    .select('template_id', { count: 'exact', head: true })
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

export async function createInstance(client: SupabaseClient, expectedUserId: string, name: string, templateIds: string[] = []) {
  const userId = await requireUser(client, expectedUserId);
  const ids = [...new Set(templateIds)];
  if (ids.length) {
    const library = await loadTemplateLibrary(client, userId);
    if (ids.some(id => !library.some(template => template.id === id))) {
      throw new Error('Um dos templates não está mais disponível nesta conta. Atualize a biblioteca.');
    }
  }
  await requireUser(client, userId);
  const { data, error } = await client.from('instances')
    .insert({ user_id: userId, name: instanceName(name) }).select(instanceColumns).single();
  if (error) throw error;
  const instance = data as Instance;
  try {
    await insertLinks(client, userId, ids.flatMap(templateId => [{ template_id: templateId, instance_id: instance.id, user_id: userId }]));
  } catch (cause) {
    throw new CommittedWriteError(`A instância foi criada, mas nem todas as associações foram concluídas. Não crie outra instância: ajuste os vínculos pela biblioteca. ${failureText(cause)}`);
  }
  return instance;
}

export async function renameInstance(client: SupabaseClient, selection: InstanceSelection, name: string) {
  const userId = await requireSelection(client, selection);
  const { data, error } = await client.from('instances').update({ name: instanceName(name) })
    .eq('id', selection.instanceId).eq('user_id', userId).select(instanceColumns).single();
  if (error) throw error;
  return data as Instance;
}

export async function deleteEmptyInstance(client: SupabaseClient, selection: InstanceSelection) {
  await requireSelection(client, selection);
  // A estrutura recebida ainda mantém templates.instance_id obrigatório.
  // Não excluir instâncias antes de validar os efeitos das FKs legadas:
  // uma contagem zero na junção não comprova ausência de dependências antigas.
  throw new Error('A exclusão de instâncias aguarda a validação da migração e dos relacionamentos antigos. Seus templates e associações foram preservados.');
}

async function readTemplates(client: SupabaseClient, userId: string, instanceId?: string) {
  const templates: InstanceTemplate[] = [];
  const columns = instanceId
    ? templateColumns.replace('template_instances(', 'template_instances!inner(')
    : templateColumns;
  for (let offset = 0; ; offset += 100) {
    let query = client.from('templates').select(columns)
      .eq('user_id', userId).eq('template_instances.user_id', userId);
    if (instanceId) query = query.eq('template_instances.instance_id', instanceId);
    const { data, error } = await query.order('created_at', { ascending: false })
      .order('id').range(offset, offset + 99);
    if (error) throw error;
    const page = (data ?? []) as unknown as (Omit<InstanceTemplate, 'instanceIds'> & {
      template_instances: { instance_id: string }[];
    })[];
    templates.push(...page.map(({ template_instances, ...template }) => ({
      ...template,
      instanceIds: (template_instances ?? []).map(link => link.instance_id),
    })));
    if (page.length < 100) break;
  }
  await requireUser(client, userId);
  return templates;
}

export async function loadTemplateLibrary(client: SupabaseClient, expectedUserId: string) {
  const userId = await requireUser(client, expectedUserId);
  return readTemplates(client, userId);
}

export async function loadInstanceTemplates(client: SupabaseClient, selection: InstanceSelection) {
  const userId = await requireSelection(client, selection);
  // Sem fallback para o vínculo legado ou para a biblioteca inteira.
  return readTemplates(client, userId, selection.instanceId);
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

type TemplateLink = { template_id: string; instance_id: string; user_id: string };

async function insertLinks(client: SupabaseClient, userId: string, links: TemplateLink[]) {
  for (let offset = 0; offset < links.length; offset += 100) {
    await requireUser(client, userId);
    const { error } = await client.from('template_instances')
      .upsert(links.slice(offset, offset + 100), { onConflict: 'template_id,instance_id', ignoreDuplicates: true });
    if (error) throw error;
  }
}

async function validateInstanceIds(client: SupabaseClient, userId: string, instanceIds: string[]) {
  const ids = [...new Set(instanceIds)];
  for (const instanceId of ids) await requireSelection(client, { userId, instanceId });
  return ids;
}

async function requireTemplate(client: SupabaseClient, userId: string, templateId: string) {
  await requireUser(client, userId);
  const { error } = await client.from('templates').select('id')
    .eq('id', templateId).eq('user_id', userId).single();
  if (error) throw error;
}

export async function replaceTemplateAssociations(client: SupabaseClient, expectedUserId: string, templateId: string, instanceIds: string[]) {
  const userId = await requireUser(client, expectedUserId);
  await requireTemplate(client, userId, templateId);
  const ids = await validateInstanceIds(client, userId, instanceIds);
  try {
    // Adicionar primeiro evita perder os vínculos anteriores se a inclusão falhar.
    await insertLinks(client, userId, ids.map(instanceId => ({ template_id: templateId, instance_id: instanceId, user_id: userId })));
    await requireUser(client, userId);
    let removal = client.from('template_instances').delete()
      .eq('user_id', userId).eq('template_id', templateId);
    // Os IDs foram validados contra instances; não vêm de um filtro livre.
    if (ids.length) removal = removal.not('instance_id', 'in', `(${ids.join(',')})`);
    const { error } = await removal;
    if (error) throw error;
  } catch (cause) {
    throw new CommittedWriteError(`As associações podem ter sido alteradas parcialmente. A biblioteca será relida; confira os vínculos antes de tentar novamente. ${failureText(cause)}`);
  }
}

export async function removeTemplateAssociation(client: SupabaseClient, expectedUserId: string, templateId: string, instanceId: string) {
  const userId = await requireUser(client, expectedUserId);
  await requireTemplate(client, userId, templateId);
  const { error } = await client.from('template_instances').delete()
    .eq('user_id', userId).eq('template_id', templateId).eq('instance_id', instanceId)
    .select('template_id').single();
  if (error) throw error;
}

export async function saveInstanceTemplate(
  client: SupabaseClient,
  expectedUserId: string,
  input: InstanceTemplateInput,
  instanceIds: string[],
  templateId?: string,
) {
  const userId = await requireUser(client, expectedUserId);
  const ids = await validateInstanceIds(client, userId, instanceIds);
  const values = templateValues(input);
  await requireUser(client, userId);
  const query = templateId
    ? client.from('templates').update(values).eq('id', templateId).eq('user_id', userId)
    : client.from('templates').insert({ ...values, user_id: userId });
  const { data, error } = await query.select('id').single();
  checkTemplateInsertError(error);
  if (!data) throw new Error('O template não foi gravado. Atualize a biblioteca.');
  const savedId = String(data.id);
  try {
    await replaceTemplateAssociations(client, userId, savedId, ids);
  } catch (cause) {
    throw new CommittedWriteError(`O conteúdo do template foi salvo na biblioteca, mas suas associações precisam ser conferidas. Não repita o cadastro: abra Editar e associações. ${failureText(cause)}`);
  }
  return savedId;
}

export async function importInstanceTemplates(client: SupabaseClient, expectedUserId: string, file: File, instanceIds: string[]) {
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
  // Só nome e conteúdo são importados; IDs, vínculos e proprietários são ignorados.
  const values = parsed.map((value, index) => templateValues(value, index));
  const userId = await requireUser(client, expectedUserId);
  const ids = await validateInstanceIds(client, userId, instanceIds);
  await requireUser(client, userId);
  const { data, error } = await client.from('templates')
    .insert(values.map(value => ({ ...value, user_id: userId }))).select('id');
  checkTemplateInsertError(error);
  if (!data || data.length !== values.length) {
    throw new CommittedWriteError('A importação foi enviada, mas a confirmação está incompleta. Confira a biblioteca antes de importar novamente.');
  }
  try {
    await insertLinks(client, userId, data.flatMap(template => ids.map(instanceId => ({
      template_id: String(template.id), instance_id: instanceId, user_id: userId,
    }))));
  } catch (cause) {
    throw new CommittedWriteError(`${values.length} template(s) foram importados para a biblioteca, mas as associações não foram concluídas integralmente. Não importe novamente; ajuste os vínculos em cada template. ${failureText(cause)}`);
  }
  return values.length;
}

export async function deleteInstanceTemplate(client: SupabaseClient, expectedUserId: string, templateId: string) {
  const userId = await requireUser(client, expectedUserId);
  // As FKs da junção removem os vínculos; o template é excluído globalmente.
  const { error } = await client.from('templates').delete().eq('id', templateId)
    .eq('user_id', userId).select('id').single();
  if (error) throw error;
}
