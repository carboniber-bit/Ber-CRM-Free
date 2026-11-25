import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, CalendarClock, CheckCircle2, FolderKanban, Handshake,
  MessageSquare, Plus, RefreshCw, Target, TrendingUp, UserPlus, Users,
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { DASHBOARD_LEAD_WINDOW, getDashboardData, type DashboardData } from '../services/dashboardService'
import { computeIndicators, conversionFunnel, countBy, leadsByMonth } from '../lib/dashboard'
import { ACTIVITY_LABELS } from '../types/activity'
import { PRIORITY_LABELS } from '../types/lead'
import { formatDateTime } from '../lib/format'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { IndicatorCard } from '../components/dashboard/IndicatorCard'
import { ChartCard } from '../components/dashboard/ChartCard'
import { cn } from '../utils/cn'

const AXIS = { stroke: '#a3a3a3', fontSize: 11 }
const GRID = '#2a2a2a'
const TOOLTIP_STYLE = {
  backgroundColor: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 12, color: '#fff', fontSize: 12,
}
// As chaves são os próprios rótulos de PRIORITY_LABELS: um literal errado deixaria a barra cinza
// em silêncio, porque a cor é resolvida por lookup, não por posição.
const PRIORITY_COLORS: Record<string, string> = {
  [PRIORITY_LABELS.muito_alta]: '#ff5de7',
  [PRIORITY_LABELS.alta]: '#fefa3d',
  [PRIORITY_LABELS.media]: '#6db5ff',
  [PRIORITY_LABELS.baixa]: '#a3a3a3',
}
const PENDING_LIMIT = 6
const ACTIVITY_LIMIT = 8
const STATUS_CHANGE_LIMIT = 5
// O mapa id→nome cobre só a janela de leads carregada (mesmo rótulo da página de Follow-ups):
// follow-up de lead fora dela existe, o que faltou foi o nome.
const UNKNOWN_LEAD_NAME = 'Nome do lead não carregado'

// Ação rápida é navegação, não botão: `<a>` com classes de botão em vez de `<button>` dentro do
// `Link` (o kit compartilhado não tem API `asChild`).
const ACTION_BASE = 'inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const ACTION_VARIANTS = {
  mint: 'bg-mint text-bg hover:bg-mint/85',
  outline: 'border border-line bg-surface text-ink hover:bg-elevated',
}
const actionClass = (variant: keyof typeof ACTION_VARIANTS) => cn(ACTION_BASE, ACTION_VARIANTS[variant])

const ROW_BASE = 'flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors hover:bg-line'

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  // Relógio do render, com o mesmo tick da página de Follow-ups: um contato que vence com o
  // dashboard aberto tem que aparecer como atrasado sem depender de recarga de dados.
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  // A carga inteira é uma consulta só por fonte; resposta atrasada de uma recarga anterior é
  // descartada em vez de sobrescrever a mais nova.
  useEffect(() => {
    let active = true
    void getDashboardData().then(
      (result) => {
        if (!active) return
        setData(result)
        // Uma carga lenta não pode nascer com o relógio do início da requisição.
        setNow(Date.now())
        setError(null)
        setLoading(false)
      },
      (cause: unknown) => {
        if (!active) return
        // Carga falhou: dados antigos na tela seriam números apresentados como atuais.
        setData(null)
        setError(cause instanceof Error ? cause.message : 'Erro ao carregar dashboard.')
        setLoading(false)
      },
    )
    return () => { active = false }
  }, [reloadKey])

  const reload = () => {
    setLoading(true)
    setError(null)
    setReloadKey((key) => key + 1)
  }

  const indicators = useMemo(
    () => (data ? computeIndicators(data.leads, data.followups, now) : null),
    [data, now],
  )
  // As séries agregam sobre até 1000 linhas: memos para a página não recontar a cada tecla do
  // relógio de render. `countBy(leads, 'priority')` é calculado uma vez e serve às barras e às
  // Cells — duas chamadas dariam duas ordens independentes para o mesmo gráfico.
  const charts = useMemo(() => (data ? {
    byMonth: leadsByMonth(data.leads),
    byNiche: countBy(data.leads, 'niche'),
    byStatus: countBy(data.leads, 'status'),
    byPriority: countBy(data.leads, 'priority'),
    funnel: conversionFunnel(data.leads),
  } : null), [data])
  const pendingFollowups = useMemo(
    () => (data ? data.followups
      .filter((followup) => followup.status === 'pendente')
      .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())
      .slice(0, PENDING_LIMIT) : []),
    [data],
  )
  const leadNameById = useMemo(
    () => new Map((data?.leads ?? []).map((lead) => [lead.id, lead.name])),
    [data],
  )
  const activities = useMemo(
    () => (data ? data.recentActivities.slice(0, ACTIVITY_LIMIT) : []),
    [data],
  )
  const statusChanges = useMemo(
    () => (data ? data.recentStatusChanges.slice(0, STATUS_CHANGE_LIMIT) : []),
    [data],
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <span role="status" className="sr-only">Carregando dashboard…</span>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-xl font-bold text-ink">Dashboard</h1>
          <Button variant="outline" onClick={reload}><RefreshCw className="h-4 w-4" /> Atualizar</Button>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {Array.from({ length: 10 }, (_, index) => <Skeleton key={index} className="h-24" />)}
        </div>
      </div>
    )
  }

  if (error || !data || !indicators || !charts) {
    return (
      <Card className="border-danger/40" role="alert">
        <p className="text-sm text-danger">{error ?? 'Erro ao carregar dashboard.'}</p>
        <Button variant="outline" className="mt-3" onClick={reload}>Tentar novamente</Button>
      </Card>
    )
  }

  const hasAnyData = data.leads.length > 0
    || data.followups.length > 0
    || data.recentActivities.length > 0
    || data.recentStatusChanges.length > 0
    || data.recentLeads.length > 0

  // Frase montada como string (não como texto JSX espalhado) para que a quebra de linha do
  // código não insira espaço antes do ';' nem do '.' no aviso de janela de leads.
  const windowNote = data.leads.length === DASHBOARD_LEAD_WINDOW
    ? `Os indicadores de leads (exceto o total) e os gráficos são calculados sobre os ${DASHBOARD_LEAD_WINDOW} leads mais recentes${
        data.totalLeads > DASHBOARD_LEAD_WINDOW ? `; há ${data.totalLeads} leads no total` : ''
      }. As contagens de follow-ups usam todos os follow-ups carregados. Afine a lista nas páginas de Leads e de Oportunidades.`
    : null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Dashboard</h1>
          <p className="text-sm text-muted">Visão geral da sua prospecção — dados reais do Supabase</p>
        </div>
        <Button variant="outline" onClick={reload}><RefreshCw className="h-4 w-4" /> Atualizar</Button>
      </div>

      <nav aria-label="Ações rápidas" className="flex flex-wrap gap-2">
        <Link to="/leads/novo" className={actionClass('mint')}><Plus className="h-4 w-4" /> Novo lead</Link>
        <Link to="/oportunidades" className={actionClass('outline')}><Target className="h-4 w-4" /> Ver oportunidades</Link>
        <Link to="/pipeline" className={actionClass('outline')}><FolderKanban className="h-4 w-4" /> Abrir pipeline</Link>
        <Link to="/followups" className={actionClass('outline')}><CalendarClock className="h-4 w-4" /> Ver follow-ups</Link>
      </nav>

      {!hasAnyData ? (
        <EmptyState
          icon={Users}
          title="Seu CRM está pronto para começar"
          description="Cadastre o primeiro estabelecimento para ver indicadores, gráficos e oportunidades em tempo real. Nenhum dado fictício é exibido aqui."
          action={
            <Link to="/leads/novo" className={actionClass('mint')}>
              <Plus className="h-4 w-4" /> Cadastrar primeiro lead
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <IndicatorCard label="Total de leads" value={data.totalLeads} icon={Users} />
            <IndicatorCard label="Novos" value={indicators.novos} icon={UserPlus} tone="accent" />
            <IndicatorCard label="Contatados" value={indicators.contatados} icon={MessageSquare} tone="accent" />
            <IndicatorCard label="Interessados" value={indicators.interessados} icon={TrendingUp} tone="primary" />
            <IndicatorCard label="Em negociação" value={indicators.negociando} icon={Handshake} tone="primary" />
            <IndicatorCard label="Convertidos" value={indicators.convertidos} icon={CheckCircle2} tone="primary" />
            <IndicatorCard label="Oportunidades" value={indicators.totalOportunidades} icon={Target} tone="lime" />
            <IndicatorCard label="Alta prioridade" value={indicators.altaPrioridade} icon={AlertTriangle} tone="pink" />
            <IndicatorCard label="Follow-ups pendentes" value={indicators.followupsPendentes} icon={CalendarClock} tone="lime" />
            <IndicatorCard label="Follow-ups atrasados" value={indicators.followupsAtrasados} icon={AlertTriangle} tone="danger" />
          </div>

          {data.leads.length === DASHBOARD_LEAD_WINDOW && (
            <p role="status" className="text-xs text-muted">{windowNote}</p>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ChartCard title="Leads cadastrados ao longo do tempo">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.byMonth}>
                  <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                  <XAxis dataKey="month" {...AXIS} />
                  <YAxis allowDecimals={false} {...AXIS} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="total" name="Leads" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Leads por nicho">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.byNiche}>
                  <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                  <XAxis dataKey="label" {...AXIS} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis allowDecimals={false} {...AXIS} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="total" name="Leads" fill="#6db5ff" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Leads por status">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.byStatus}>
                  <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                  <XAxis dataKey="label" {...AXIS} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis allowDecimals={false} {...AXIS} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="total" name="Leads" fill="#22c55e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Oportunidades por prioridade">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.byPriority}>
                  <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                  <XAxis dataKey="label" {...AXIS} />
                  <YAxis allowDecimals={false} {...AXIS} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="total" name="Oportunidades" radius={[6, 6, 0, 0]}>
                    {charts.byPriority.map((entry) => (
                      <Cell key={entry.label} fill={PRIORITY_COLORS[entry.label] ?? '#a3a3a3'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Conversão de leads">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.funnel} layout="vertical">
                  <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} {...AXIS} />
                  <YAxis type="category" dataKey="label" width={90} {...AXIS} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="total" name="Leads" fill="#fefa3d" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <Card title="Próximos follow-ups" dot="lime">
              {pendingFollowups.length === 0 ? (
                <p className="text-sm text-muted">
                  Nenhum follow-up pendente.{' '}
                  <Link to="/followups" className="font-medium text-primary hover:underline">
                    Agende um contato
                  </Link>{' '}
                  pela página de Follow-ups ou pela ficha do lead.
                </p>
              ) : (
                <ul className="flex flex-col gap-2" aria-label="Próximos follow-ups">
                  {pendingFollowups.map((followup) => {
                    const overdue = new Date(followup.due_at).getTime() < now
                    return (
                      <li key={followup.id}>
                        <Link
                          to={`/leads/${followup.lead_id}`}
                          className={cn(ROW_BASE, overdue ? 'border-danger/40 bg-danger/5' : 'border-line bg-elevated')}
                        >
                          <span className="min-w-0 truncate text-ink">
                            {leadNameById.get(followup.lead_id) ?? UNKNOWN_LEAD_NAME}
                          </span>
                          <time
                            dateTime={followup.due_at}
                            className={cn('shrink-0 text-xs', overdue ? 'font-medium text-danger' : 'text-muted')}
                          >
                            {formatDateTime(followup.due_at)} {overdue && '· atrasado'}
                          </time>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            <Card title="Últimos leads cadastrados" dot="mint">
              {data.recentLeads.length === 0 ? (
                <p className="text-sm text-muted">Nenhum lead recente carregado.</p>
              ) : (
                <ul className="flex flex-col gap-2" aria-label="Últimos leads cadastrados">
                  {data.recentLeads.map((lead) => (
                    <li key={lead.id}>
                      <Link to={`/leads/${lead.id}`} className={cn(ROW_BASE, 'border-line bg-elevated')}>
                        <span className="min-w-0 truncate text-ink">{lead.name}</span>
                        <span className="shrink-0 text-xs text-muted">{formatDateTime(lead.created_at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Atividades recentes" dot="pink">
              {activities.length === 0 ? (
                <p className="text-sm text-muted">Nenhuma atividade recente carregada.</p>
              ) : (
                <ul className="flex flex-col gap-2" aria-label="Atividades recentes">
                  {activities.map((activity) => (
                    <li key={activity.id} className="rounded-xl border border-line bg-elevated px-3 py-2.5 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <Link to={`/leads/${activity.lead_id}`} className="min-w-0 truncate font-medium text-ink hover:text-primary">
                          {activity.leadName}
                        </Link>
                        <span className="shrink-0 text-xs text-muted">{formatDateTime(activity.created_at)}</span>
                      </div>
                      <p className="mt-0.5 break-words text-xs text-muted">
                        {ACTIVITY_LABELS[activity.type]} — {activity.description}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Mudanças de status recentes" dot="accent">
              {statusChanges.length === 0 ? (
                <p className="text-sm text-muted">Nenhuma mudança de status recente carregada.</p>
              ) : (
                <ul className="flex flex-col gap-2" aria-label="Mudanças de status recentes">
                  {statusChanges.map((activity) => (
                    <li key={activity.id} className="rounded-xl border border-line bg-elevated px-3 py-2.5 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <Link to={`/leads/${activity.lead_id}`} className="min-w-0 truncate font-medium text-ink hover:text-primary">
                          {activity.leadName}
                        </Link>
                        <span className="shrink-0 text-xs text-muted">{formatDateTime(activity.created_at)}</span>
                      </div>
                      <p className="mt-0.5 break-words text-xs text-muted">{activity.description}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
