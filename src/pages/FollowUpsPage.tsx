import { useEffect, useState } from 'react'
import { CalendarClock, RefreshCw } from 'lucide-react'
import { listFollowups } from '../services/followupService'
import { listLeads } from '../services/leadService'
import type { Followup, FollowupList } from '../types/followup'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { FollowupItem } from '../components/followups/FollowupItem'
import { cn } from '../utils/cn'

const TABS: Array<{ value: FollowupList; label: string }> = [
  { value: 'today', label: 'Hoje' },
  { value: 'upcoming', label: 'Futuros' },
  { value: 'overdue', label: 'Atrasados' },
  { value: 'done', label: 'Concluídos' },
]

// O mapa id→nome cobre só a janela lida. Um follow-up cujo lead ficou fora dela continua
// existindo, então o rótulo diz que o nome não veio — nunca que o lead foi removido.
const LEAD_NAME_WINDOW = 1000
const UNKNOWN_LEAD_NAME = 'Lead não carregado nesta lista'

const AGENDAR_DESCRIPTION = 'Agende follow-ups na ficha de cada lead para organizar seus próximos contatos.'

function emptyCopy(tab: FollowupList): { title: string; description: string } {
  if (tab === 'overdue') {
    return { title: 'Nenhum follow-up atrasado', description: 'Tudo em dia. Continue acompanhando os próximos contatos.' }
  }
  if (tab === 'done') {
    return { title: 'Nenhum follow-up concluído', description: AGENDAR_DESCRIPTION }
  }
  return { title: 'Nenhum follow-up aqui', description: AGENDAR_DESCRIPTION }
}

export function FollowUpsPage() {
  const [tab, setTab] = useState<FollowupList>('today')
  const [followups, setFollowups] = useState<Followup[]>([])
  const [leadNames, setLeadNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // Relógio do render (mesma base da ficha do lead): um contato que vence com a página aberta
  // precisa aparecer como atrasado sem depender de uma recarga de dados.
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let active = true
    void Promise.all([
      listFollowups(tab),
      listLeads({}, 'created_desc', 0, LEAD_NAME_WINDOW),
    ]).then(
      ([rows, leadsResult]) => {
        if (!active) return
        setFollowups(rows)
        setLeadNames(new Map(leadsResult.leads.map((lead) => [lead.id, lead.name])))
        setError(null)
        setLoading(false)
      },
      (cause: unknown) => {
        if (!active) return
        // Sem resposta confirmada, linha antiga na tela seria afirmar um estado que não se sabe.
        setFollowups([])
        setLeadNames(new Map())
        setError(cause instanceof Error ? cause.message : 'Erro ao carregar follow-ups.')
        setLoading(false)
      },
    )
    return () => { active = false }
  }, [tab, refreshKey])

  const changeTab = (next: FollowupList) => {
    if (next === tab) return
    setTab(next)
    setLoading(true)
    setError(null)
  }

  // Também é o que uma conclusão/cancelamento pede: a linha muda de lista (sai de Hoje, entra
  // em Concluídos), então a aba é recarregada em vez de a linha ser remendada em memória.
  const reload = () => {
    setLoading(true)
    setError(null)
    setRefreshKey((key) => key + 1)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Follow-ups</h1>
          <p className="text-sm text-muted">Acompanhe os próximos contatos e não deixe nenhum esfriar</p>
        </div>
        <Button variant="outline" onClick={reload}><RefreshCw className="h-4 w-4" /> Atualizar</Button>
      </div>

      <div role="group" aria-label="Listas de follow-ups" className="flex flex-wrap gap-2">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={tab === value}
            onClick={() => changeTab(value)}
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
              tab === value ? 'bg-primary/15 text-primary' : 'bg-surface text-muted hover:bg-elevated hover:text-ink',
              value === 'overdue' && tab !== value && 'text-danger',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <span role="status" className="sr-only">Carregando follow-ups…</span>}

      {error ? (
        <Card className="border-danger/40" role="alert">
          <p className="text-sm text-danger">{error}</p>
          <Button variant="outline" className="mt-3" onClick={reload}>Tentar novamente</Button>
        </Card>
      ) : loading ? (
        <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : followups.length === 0 ? (
        <EmptyState icon={CalendarClock} {...emptyCopy(tab)} />
      ) : (
        // key por aba: trocar de lista desmonta a linha, nenhum formulário aberto sobrevive à troca.
        <ul key={tab} className="flex flex-col gap-2" aria-label="Follow-ups">
          {followups.map((followup) => (
            <FollowupItem
              key={followup.id}
              followup={followup}
              lead={{
                name: leadNames.get(followup.lead_id) ?? UNKNOWN_LEAD_NAME,
                href: `/leads/${followup.lead_id}`,
              }}
              onChanged={reload}
              now={now}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
