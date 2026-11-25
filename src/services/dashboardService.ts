import { listRecentActivities } from './activityService'
import { listFollowups } from './followupService'
import { listLeads, listRecentLeads } from './leadService'
import type { Activity } from '../types/activity'
import type { Followup } from '../types/followup'
import type { Lead } from '../types/lead'

// O dashboard agrega no cliente (lib/dashboard.ts), então a janela lida é o limite do que ele
// pode afirmar. 1000 linhas numa única consulta cabem na tier free e cobrem o uso pessoal.
export const DASHBOARD_LEAD_WINDOW = 1000
// 12 atividades: a página mostra 8 em "Atividades recentes" e filtra "Mudanças de status
// recentes" no mesmo payload — uma consulta só, duas listas honestas.
const ACTIVITY_WINDOW = 12
const RECENT_LEADS = 5

export interface DashboardData {
  leads: Lead[]
  /** Total real de leads (count do Supabase), não o tamanho da janela carregada. */
  totalLeads: number
  followups: Followup[]
  recentActivities: Array<Activity & { leadName: string }>
  recentLeads: Lead[]
}

/**
 * Uma carga do dashboard: leads (janela), follow-ups de todos os status, atividades recentes com
 * nome do lead e os últimos leads cadastrados. Falha em qualquer consulta derruba a carga inteira
 * — painel pela metade afirmaria um estado que não se sabe.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const [leadsResult, followups, recentActivities, recentLeads] = await Promise.all([
    listLeads({}, 'created_desc', 0, DASHBOARD_LEAD_WINDOW),
    listFollowups('all'),
    listRecentActivities(ACTIVITY_WINDOW),
    listRecentLeads(RECENT_LEADS),
  ])
  return {
    leads: leadsResult.leads,
    totalLeads: leadsResult.total,
    followups,
    recentActivities,
    recentLeads,
  }
}
