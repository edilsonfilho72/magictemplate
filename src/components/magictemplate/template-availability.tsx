import type { InstanceWithCount } from './instance-data';

export type TemplateAvailabilityValue = { mode: 'all' | 'specific'; ids: string[] };

export function resolveAvailability(value: TemplateAvailabilityValue, instances: InstanceWithCount[]) {
  return value.mode === 'all' ? instances.map(instance => instance.id) : value.ids;
}

export function TemplateAvailability({ value, onChange, instances, disabled = false }: {
  value: TemplateAvailabilityValue;
  onChange: (value: TemplateAvailabilityValue) => void;
  instances: InstanceWithCount[];
  disabled?: boolean;
}) {
  return <fieldset disabled={disabled} className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/30 p-4 text-foreground disabled:opacity-60">
    <legend className="px-1 text-sm font-semibold text-slate-700">Disponibilidade do template</legend>
    <label className="flex items-start gap-3 text-sm text-slate-700">
      <input type="checkbox" checked={value.mode === 'all'} onChange={event => onChange({ mode: event.target.checked ? 'all' : 'specific', ids: value.mode === 'all' ? instances.map(instance => instance.id) : value.ids })} className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500" />
      <span>Todas as instâncias atualmente cadastradas</span>
    </label>
    <p className="text-xs leading-relaxed text-slate-500">A opção Todas usa as instâncias exibidas neste momento. Novas instâncias não recebem vínculos automaticamente. Nenhuma seleção mantém o template somente na biblioteca.</p>
    <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3">
      {instances.length ? instances.map(instance => <label key={instance.id} className="flex items-center gap-3 text-sm text-slate-700">
        <input type="checkbox" disabled={value.mode === 'all'} checked={value.mode === 'all' || value.ids.includes(instance.id)} onChange={event => onChange({ mode: 'specific', ids: event.target.checked ? [...value.ids, instance.id] : value.ids.filter(id => id !== instance.id) })} className="h-4 w-4 shrink-0 rounded border-slate-300 accent-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500" />
        <span className="break-words">{instance.name}</span>
      </label>) : <p className="text-sm text-slate-500">Nenhuma instância cadastrada.</p>}
    </div>
  </fieldset>;
}
