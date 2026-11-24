import { Search } from 'lucide-react'
import {
  LEAD_STATUSES, NICHES, NICHE_LABELS, PRESENCE_FIELDS, PRESENCE_FIELD_LABELS,
  PRESENCE_LABELS, PRESENCE_VALUES, STATUS_LABELS,
  type LeadFilters, type LeadSort, type Presence, type PresenceField,
} from '../../types/lead'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'

interface LeadFiltersBarProps {
  filters: LeadFilters
  sort: LeadSort
  onChange: (filters: LeadFilters) => void
  onSortChange: (sort: LeadSort) => void
}

const sortOptions = [
  { value: 'created_desc', label: 'Mais recentes' },
  { value: 'created_asc', label: 'Mais antigos' },
  { value: 'score_desc', label: 'Maior pontuação' },
  { value: 'score_asc', label: 'Menor pontuação' },
]

export function LeadFiltersBar({ filters, sort, onChange, onSortChange }: LeadFiltersBarProps) {
  const set = (patch: Partial<LeadFilters>) => onChange({ ...filters, ...patch })

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="relative sm:col-span-2 lg:col-span-1">
        <Input
          label="Buscar por nome"
          placeholder="Nome do estabelecimento"
          value={filters.search ?? ''}
          onChange={(e) => set({ search: e.target.value || undefined })}
        />
        <Search className="pointer-events-none absolute right-3 top-9 h-4 w-4 text-muted" />
      </div>
      <Select
        label="Nicho"
        placeholder="Todos"
        value={filters.niche ?? ''}
        onChange={(e) => set({ niche: e.target.value || undefined })}
        options={NICHES.map((n) => ({ value: n, label: NICHE_LABELS[n] }))}
      />
      <Input label="Cidade" placeholder="Todas" value={filters.city ?? ''} onChange={(e) => set({ city: e.target.value || undefined })} />
      <Input label="Bairro" placeholder="Todos" value={filters.district ?? ''} onChange={(e) => set({ district: e.target.value || undefined })} />
      <Select
        label="Status"
        placeholder="Todos"
        value={filters.status ?? ''}
        onChange={(e) => set({ status: (e.target.value || undefined) as LeadFilters['status'] })}
        options={LEAD_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
      />
      <Select
        label="Presença digital"
        placeholder="Qualquer"
        value={filters.presenceField ?? ''}
        onChange={(e) => set({
          presenceField: (e.target.value || undefined) as PresenceField | undefined,
          presenceValue: e.target.value ? filters.presenceValue ?? 'no' : undefined,
        })}
        options={PRESENCE_FIELDS.map((f) => ({ value: f, label: PRESENCE_FIELD_LABELS[f] }))}
      />
      <Select
        label="Valor da presença"
        placeholder="—"
        value={filters.presenceValue ?? ''}
        disabled={!filters.presenceField}
        onChange={(e) => set({ presenceValue: (e.target.value || undefined) as Presence | undefined })}
        options={PRESENCE_VALUES.map((v) => ({ value: v, label: PRESENCE_LABELS[v] }))}
      />
      <Select label="Ordenar por" value={sort} onChange={(e) => onSortChange(e.target.value as LeadSort)} options={sortOptions} />
      <Input label="Cadastrado de" type="date" value={filters.createdFrom ?? ''} onChange={(e) => set({ createdFrom: e.target.value || undefined })} />
      <Input label="Cadastrado até" type="date" value={filters.createdTo ?? ''} onChange={(e) => set({ createdTo: e.target.value || undefined })} />
    </div>
  )
}
