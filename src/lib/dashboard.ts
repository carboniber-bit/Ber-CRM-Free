import {
  INELIGIBLE_STATUSES, NICHE_LABELS, PRIORITY_LABELS, STATUS_LABELS, situationStatuses,
  type Lead, type LeadStatus, type Niche, type Priority,
} from '../types/lead'
import type { Followup } from '../types/followup'
import { isEligibleOpportunity } from './opportunity'

export interface DashboardIndicators {
  totalLeads: number
  novos: number
  contatados: number
  interessados: number
  negociando: number
  convertidos: number
  totalOportunidades: number
  altaPrioridade: number
  followupsPendentes: number
  followupsAtrasados: number
}

// Fonte única de verdade do grupo "contato realizado" (src/types/lead.ts).
const CONTATADOS: LeadStatus[] = situationStatuses('contato_realizado')

export function computeIndicators(
  leads: Lead[],
  followups: Followup[],
  convertedCount: number,
  now = Date.now(),
): DashboardIndicators {
  const opportunities = leads.filter(isEligibleOpportunity)
  const pending = followups.filter((f) => f.status === 'pendente')
  return {
    totalLeads: leads.length,
    novos: leads.filter((l) => l.status === 'novo').length,
    contatados: leads.filter((l) => CONTATADOS.includes(l.status)).length,
    interessados: leads.filter((l) => l.status === 'interessado').length,
    negociando: leads.filter((l) => l.status === 'negociando').length,
    convertidos: convertedCount,
    totalOportunidades: opportunities.length,
    altaPrioridade: opportunities.filter((l) => l.priority === 'alta' || l.priority === 'muito_alta').length,
    followupsPendentes: pending.length,
    followupsAtrasados: pending.filter((f) => new Date(f.due_at).getTime() < now).length,
  }
}

export function leadsByMonth(leads: Lead[], now = new Date()): Array<{ month: string; total: number }> {
  const buckets = new Map<string, { sortKey: number; total: number }>()
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(2)}`
    buckets.set(key, { sortKey: date.getTime(), total: 0 })
  }
  for (const lead of leads) {
    const date = new Date(lead.created_at)
    const key = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(2)}`
    const bucket = buckets.get(key)
    if (bucket) bucket.total += 1
  }
  return [...buckets.entries()]
    .sort((a, b) => a[1].sortKey - b[1].sortKey)
    .map(([month, { total }]) => ({ month, total }))
}

function nicheLabel(niche: string | null): string {
  const raw = (niche || 'outros') as Niche
  return NICHE_LABELS[raw] ?? raw
}

export function countBy(leads: Lead[], key: 'niche' | 'status' | 'priority'): Array<{ label: string; total: number }> {
  const source = key === 'priority' ? leads.filter(isEligibleOpportunity) : leads
  const counts = new Map<string, number>()
  for (const lead of source) {
    const label =
      key === 'niche' ? nicheLabel(lead.niche)
      : key === 'status' ? STATUS_LABELS[lead.status]
      : PRIORITY_LABELS[lead.priority]
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()].map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total)
}

export function conversionFunnel(leads: Lead[]): Array<{ label: string; total: number }> {
  return [
    { label: 'Novo', total: leads.filter((l) => l.status === 'novo').length },
    { label: 'Contatado', total: leads.filter((l) => CONTATADOS.includes(l.status)).length },
    { label: 'Interessado', total: leads.filter((l) => l.status === 'interessado').length },
    { label: 'Negociando', total: leads.filter((l) => l.status === 'negociando').length },
    { label: 'Aceitou', total: leads.filter((l) => l.status === 'aceitou').length },
  ]
}

const PRIORITY_ORDER: Record<Priority, number> = { muito_alta: 0, alta: 1, media: 2, baixa: 3 }

export function prospectingQueue(leads: Lead[], followups: Followup[]): Lead[] {
  const now = Date.now()
  const overdueLeadIds = new Set(
    followups
      .filter((f) => f.status === 'pendente' && new Date(f.due_at).getTime() < now)
      .map((f) => f.lead_id),
  )
  return leads
    .filter((l) => !INELIGIBLE_STATUSES.includes(l.status))
    .sort((a, b) => {
      const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      if (priorityDiff !== 0) return priorityDiff
      const overdueDiff = Number(overdueLeadIds.has(b.id)) - Number(overdueLeadIds.has(a.id))
      if (overdueDiff !== 0) return overdueDiff
      if (a.score !== b.score) return b.score - a.score
      const newDiff = Number(b.status === 'novo') - Number(a.status === 'novo')
      if (newDiff !== 0) return newDiff
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })
}
