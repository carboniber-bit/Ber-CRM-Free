import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowRightLeft, CalendarClock, FileText, MessageSquare, Phone,
  PhoneIncoming, StickyNote, UserCheck, Users, type LucideIcon,
} from 'lucide-react'
import { listActivities } from '../../services/activityService'
import { ACTIVITY_LABELS, type Activity, type ActivityType } from '../../types/activity'
import { formatDateTime } from '../../lib/format'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { Skeleton } from '../ui/Skeleton'

const icons: Record<ActivityType, LucideIcon> = {
  primeiro_contato: UserCheck,
  mensagem: MessageSquare,
  ligacao: Phone,
  resposta: PhoneIncoming,
  reuniao: Users,
  proposta: FileText,
  mudanca_status: ArrowRightLeft,
  observacao: StickyNote,
  follow_up: CalendarClock,
  outro: StickyNote,
}

export function LeadTimeline({ leadId, refreshKey }: { leadId: string; refreshKey: number }) {
  return <LeadTimelineContent key={`${leadId}:${refreshKey}`} leadId={leadId} />
}

function LeadTimelineContent({ leadId }: { leadId: string }) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef(0)

  const handleSuccess = useCallback((request: number, nextActivities: Activity[]) => {
    if (request !== requestRef.current) return
    setActivities(nextActivities)
    setError(null)
    setLoading(false)
  }, [])

  const handleError = useCallback((request: number, cause: unknown) => {
    if (request !== requestRef.current) return
    setError(cause instanceof Error ? cause.message : 'Erro ao carregar histórico.')
    setLoading(false)
  }, [])

  useEffect(() => {
    const request = ++requestRef.current
    void listActivities(leadId).then(
      (nextActivities) => handleSuccess(request, nextActivities),
      (cause: unknown) => handleError(request, cause),
    )
    return () => {
      requestRef.current += 1
    }
  }, [leadId, handleSuccess, handleError])

  const retry = () => {
    const request = ++requestRef.current
    setActivities([])
    setLoading(true)
    setError(null)
    void listActivities(leadId).then(
      (nextActivities) => handleSuccess(request, nextActivities),
      (cause: unknown) => handleError(request, cause),
    )
  }

  return (
    <Card title="Histórico de contatos" dot="pink" aria-busy={loading}>
      {loading && <span role="status" className="sr-only">Carregando histórico de contatos…</span>}
      {loading ? (
        <Skeleton className="h-32" />
      ) : error ? (
        <div className="rounded-xl border border-danger/40 bg-danger/5 p-4" role="alert">
          <p className="text-sm font-medium text-danger">Não foi possível carregar o histórico.</p>
          <p className="mt-1 text-sm text-muted">{error}</p>
          <Button type="button" variant="outline" className="mt-3" onClick={retry}>
            Tentar novamente
          </Button>
        </div>
      ) : activities.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Nenhum contato registrado"
          description="Registre o primeiro contato, ligação ou observação para começar o histórico deste lead."
        />
      ) : (
        <ol className="flex flex-col" aria-label="Atividades do lead">
          {activities.map((activity, index) => {
            const Icon = icons[activity.type]
            return (
              <li key={activity.id} className="relative flex gap-3 pb-5 last:pb-0">
                {index < activities.length - 1 && (
                  <span
                    className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px bg-line"
                    aria-hidden="true"
                  />
                )}
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-elevated">
                  <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{ACTIVITY_LABELS[activity.type]}</p>
                  <p className="whitespace-pre-wrap break-words text-sm text-muted">{activity.description}</p>
                  <time dateTime={activity.created_at} className="mt-0.5 block text-xs text-muted/70">
                    {formatDateTime(activity.created_at)}
                  </time>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}
