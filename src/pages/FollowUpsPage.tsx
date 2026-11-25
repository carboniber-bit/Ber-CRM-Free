import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, Plus, RefreshCw } from 'lucide-react'
import { listFollowups } from '../services/followupService'
import { listLeads } from '../services/leadService'
import type { Followup, FollowupList } from '../types/followup'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Select } from '../components/ui/Select'
import { Skeleton } from '../components/ui/Skeleton'
import { FollowupItem } from '../components/followups/FollowupItem'
import { FollowupDialog } from '../components/leads/FollowupDialog'
import { cn } from '../utils/cn'

const TABS: Array<{ value: FollowupList; label: string }> = [
  { value: 'today', label: 'Hoje' },
  { value: 'upcoming', label: 'Futuros' },
  { value: 'overdue', label: 'Atrasados' },
  { value: 'done', label: 'Concluídos' },
]

// O mapa id→nome cobre só a janela lida. Um follow-up cujo lead ficou fora dela continua
// existindo, então o rótulo fala do nome que não veio — nunca de lista vazia ou de lead removido.
const LEAD_NAME_WINDOW = 1000
const UNKNOWN_LEAD_NAME = 'Nome do lead não carregado'

function emptyCopy(tab: FollowupList): { title: string; description: string } {
  if (tab === 'overdue') {
    return { title: 'Nenhum follow-up atrasado', description: 'Tudo em dia. Continue acompanhando os próximos contatos.' }
  }
  if (tab === 'done') {
    return {
      title: 'Nenhum follow-up concluído',
      description: 'Follow-ups concluídos aparecem aqui com a data e o resultado registrados.',
    }
  }
  return {
    title: 'Nenhum follow-up aqui',
    description: 'Agende um follow-up escolhendo o lead acima, ou pela ficha do lead, para organizar seus próximos contatos.',
  }
}

export function FollowUpsPage() {
  const [tab, setTab] = useState<FollowupList>('today')
  const [followups, setFollowups] = useState<Followup[]>([])
  const [leads, setLeads] = useState<Array<{ id: string; name: string }>>([])
  const [rowsLoading, setRowsLoading] = useState(true)
  const [namesLoading, setNamesLoading] = useState(true)
  const [rowsError, setRowsError] = useState<string | null>(null)
  const [namesError, setNamesError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [namesKey, setNamesKey] = useState(0)
  const [schedulingLeadId, setSchedulingLeadId] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  // Relógio do render (mesma base da ficha do lead): um contato que vence com a página aberta
  // precisa aparecer como atrasado sem depender de uma recarga de dados.
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let active = true
    void listFollowups(tab).then(
      (rows) => {
        if (!active) return
        setFollowups(rows)
        setRowsError(null)
        setRowsLoading(false)
      },
      (cause: unknown) => {
        if (!active) return
        // Sem resposta confirmada, linha antiga na tela seria afirmar um estado que não se sabe.
        setFollowups([])
        setRowsError(cause instanceof Error ? cause.message : 'Erro ao carregar follow-ups.')
        setRowsLoading(false)
      },
    )
    return () => { active = false }
  }, [tab, refreshKey])

  // A janela de nomes custa até 1000 linhas completas. Ela vive fora da lista de follow-ups:
  // trocar de aba, concluir ou cancelar não podem rebuscá-la — só a montagem e o Atualizar.
  useEffect(() => {
    let active = true
    void listLeads({}, 'created_desc', 0, LEAD_NAME_WINDOW).then(
      (result) => {
        if (!active) return
        setLeads(result.leads.map((lead) => ({ id: lead.id, name: lead.name })))
        setNamesError(null)
        setNamesLoading(false)
      },
      (cause: unknown) => {
        if (!active) return
        // Falha de nomes é erro da página, não lista sem lead: o nome é o que liga a linha a alguém.
        setLeads([])
        setNamesError(cause instanceof Error ? cause.message : 'Erro ao carregar os leads.')
        setNamesLoading(false)
      },
    )
    return () => { active = false }
  }, [namesKey])

  const leadNames = useMemo(() => new Map(leads.map((lead) => [lead.id, lead.name])), [leads])
  const leadOptions = useMemo(
    () => [...leads]
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .map((lead) => ({ value: lead.id, label: lead.name })),
    [leads],
  )
  // O lead escolhido pode sair da janela numa recarga: sem nome carregado não se agenda daqui.
  const canSchedule = schedulingLeadId !== '' && leadNames.has(schedulingLeadId)
  const loading = rowsLoading || namesLoading
  const error = rowsError ?? namesError

  const changeTab = (next: FollowupList) => {
    if (next === tab) return
    setTab(next)
    setRowsLoading(true)
    setRowsError(null)
  }

  // Também é o que uma conclusão/cancelamento pede: a linha muda de lista (sai de Hoje, entra
  // em Concluídos), então a aba é recarregada em vez de a linha ser remendada em memória.
  const reloadRows = () => {
    setRowsLoading(true)
    setRowsError(null)
    setRefreshKey((key) => key + 1)
  }

  // Recarga completa: o usuário pediu explicitamente para trazer tudo de novo.
  const reloadAll = () => {
    reloadRows()
    setNamesLoading(true)
    setNamesError(null)
    setNamesKey((key) => key + 1)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Follow-ups</h1>
          <p className="text-sm text-muted">Acompanhe os próximos contatos e não deixe nenhum esfriar</p>
        </div>
        <Button variant="outline" onClick={reloadAll}><RefreshCw className="h-4 w-4" /> Atualizar</Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-end gap-2">
          <Select
            label="Lead do novo follow-up"
            placeholder="Selecione o lead"
            value={schedulingLeadId}
            onChange={(event) => setSchedulingLeadId(event.target.value)}
            options={leadOptions}
            disabled={leadOptions.length === 0}
            className="w-full sm:w-72"
          />
          <Button variant="mint" onClick={() => setDialogOpen(true)} disabled={!canSchedule}>
            <Plus className="h-4 w-4" /> Agendar follow-up
          </Button>
        </div>
        <p className="text-xs text-muted">
          O agendamento aqui usa os {LEAD_NAME_WINDOW} leads mais recentes; fora dessa janela, agende pela
          ficha do lead.
        </p>
      </div>

      <div className="flex flex-col gap-2">
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
        {/* A fila de "prospectar hoje" pertence à página de Oportunidades (§5/§17): aqui é ponteiro,
            não uma segunda cópia da lista. */}
        <p className="text-xs text-muted">
          <Link to="/oportunidades" className="font-medium text-primary hover:underline">
            Oportunidades para prospectar hoje
          </Link>{' '}
          — a fila de prospecção está na página de Oportunidades.
        </p>
      </div>

      {loading && <span role="status" className="sr-only">Carregando follow-ups…</span>}

      {error ? (
        <Card className="border-danger/40" role="alert">
          <p className="text-sm text-danger">{error}</p>
          <Button variant="outline" className="mt-3" onClick={reloadAll}>Tentar novamente</Button>
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
              onChanged={reloadRows}
              onObsolete={reloadRows}
              now={now}
            />
          ))}
        </ul>
      )}

      {/* O diálogo vive do lead escolhido: fechado o seletor, nada de formulário órfão. */}
      {dialogOpen && schedulingLeadId !== '' && (
        <FollowupDialog
          open
          leadId={schedulingLeadId}
          onClose={() => setDialogOpen(false)}
          onSaved={reloadRows}
        />
      )}
    </div>
  )
}
