import {
  INELIGIBLE_STATUSES, NEEDS, NEED_LABELS, NICHES, NICHE_LABELS, PRIORITIES, PRIORITY_LABELS,
  SITUATIONS, SITUATION_LABELS, situationStatuses, type LeadFilters,
} from '../../types/lead'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'

interface OpportunityFiltersProps {
  filters: LeadFilters
  onChange: (filters: LeadFilters) => void
}

const NEED_FILTER_OPTIONS = [
  ...NEEDS.map((n) => ({ value: n, label: NEED_LABELS[n] })),
  { value: 'instagram_sem_site', label: 'Instagram sem site' },
  { value: 'sem_site_sem_cardapio', label: 'Sem site e sem cardápio' },
]

// A consulta de oportunidades exclui INELIGIBLE_STATUSES (leadService.listLeads), então uma
// situação cujo conjunto de status está todo contido nele jamais devolveria linha: a opção
// é derivada dos mapas de src/types/lead.ts para não oferecer filtro impossível.
const SITUATION_FILTER_OPTIONS = SITUATIONS
  .filter((s) => situationStatuses(s).some((status) => !INELIGIBLE_STATUSES.includes(status)))
  .map((s) => ({ value: s, label: SITUATION_LABELS[s] }))

export function OpportunityFilters({ filters, onChange }: OpportunityFiltersProps) {
  const set = (patch: Partial<LeadFilters>) => onChange({ ...filters, ...patch })
  const needValue = filters.instagramWithoutSite ? 'instagram_sem_site'
    : filters.noSiteNoMenu ? 'sem_site_sem_cardapio'
    : filters.need ?? ''

  const changeNeed = (value: string) => {
    set({
      need: undefined, instagramWithoutSite: undefined, noSiteNoMenu: undefined,
      ...(value === 'instagram_sem_site' ? { instagramWithoutSite: true }
        : value === 'sem_site_sem_cardapio' ? { noSiteNoMenu: true }
        : value ? { need: value as LeadFilters['need'] } : {}),
    })
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Select label="Nicho" placeholder="Todos" value={filters.niche ?? ''} onChange={(e) => set({ niche: e.target.value || undefined })} options={NICHES.map((n) => ({ value: n, label: NICHE_LABELS[n] }))} />
      <Select label="Necessidade" placeholder="Todas" value={needValue} onChange={(e) => changeNeed(e.target.value)} options={NEED_FILTER_OPTIONS} />
      <Select label="Prioridade" placeholder="Todas" value={filters.priority ?? ''} onChange={(e) => set({ priority: (e.target.value || undefined) as LeadFilters['priority'] })} options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))} />
      <Select label="Situação" placeholder="Todas" value={filters.situation ?? ''} onChange={(e) => set({ situation: (e.target.value || undefined) as LeadFilters['situation'] })} options={SITUATION_FILTER_OPTIONS} />
      <Input label="Cidade" placeholder="Todas" value={filters.city ?? ''} onChange={(e) => set({ city: e.target.value || undefined })} />
      <Input label="Bairro" placeholder="Todos" value={filters.district ?? ''} onChange={(e) => set({ district: e.target.value || undefined })} />
      <Input label="Cadastrado de" type="date" value={filters.createdFrom ?? ''} onChange={(e) => set({ createdFrom: e.target.value || undefined })} />
      <Input label="Cadastrado até" type="date" value={filters.createdTo ?? ''} onChange={(e) => set({ createdTo: e.target.value || undefined })} />
      <Input label="Pontuação mínima" type="number" min="0" max="100" value={filters.minScore ?? ''} onChange={(e) => set({ minScore: e.target.value === '' ? undefined : Number(e.target.value) })} />
      <Input label="Pontuação máxima" type="number" min="0" max="100" value={filters.maxScore ?? ''} onChange={(e) => set({ maxScore: e.target.value === '' ? undefined : Number(e.target.value) })} />
    </div>
  )
}
