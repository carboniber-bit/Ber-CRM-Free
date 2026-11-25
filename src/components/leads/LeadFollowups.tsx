import { useCallback, useEffect, useRef, useState } from 'react'
import { listByLead } from '../../services/followupService'
import type { Followup } from '../../types/followup'
import { useToast } from '../../hooks/useToast'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Skeleton } from '../ui/Skeleton'
import { FollowupItem } from '../followups/FollowupItem'

interface LeadFollowupsProps {
  leadId: string
  refreshKey: number
  onChanged: () => void
  /** Nome real do lead, fornecido pela ficha. Sem ele a linha continua legível pela data. */
  leadName?: string
}

interface FollowupsLoadState {
  followups: Followup[]
  loaded: boolean
  loading: boolean
  refreshing: boolean
  error: string | null
}

export function LeadFollowups(props: LeadFollowupsProps) {
  return <LeadFollowupsContent key={props.leadId} {...props} />
}

function LeadFollowupsContent({ leadId, leadName, refreshKey, onChanged }: LeadFollowupsProps) {
  const { toast } = useToast()
  const [loadState, setLoadState] = useState<FollowupsLoadState>({
    followups: [],
    loaded: false,
    loading: true,
    refreshing: false,
    error: null,
  })
  const [now, setNow] = useState(() => Date.now())
  const requestRef = useRef(0)
  const activeRef = useRef(true)
  const lastRefreshKeyRef = useRef(refreshKey)
  const isBusy = loadState.loading || loadState.refreshing

  const handleLoadSuccess = useCallback((request: number, followups: Followup[]): boolean => {
    if (!activeRef.current || request !== requestRef.current) return false
    setLoadState({ followups, loaded: true, loading: false, refreshing: false, error: null })
    return true
  }, [])

  const handleLoadError = useCallback((request: number, cause: unknown, background: boolean) => {
    if (!activeRef.current || request !== requestRef.current) return
    const message = cause instanceof Error ? cause.message : 'Erro ao carregar follow-ups.'
    setLoadState((current) => ({
      followups: background ? current.followups : [],
      loaded: background ? current.loaded : false,
      loading: false,
      refreshing: false,
      error: message,
    }))
    toast(message, 'error')
  }, [toast])

  const load = useCallback(async (background = false): Promise<Followup[] | null> => {
    if (!activeRef.current) return null
    const request = ++requestRef.current
    setLoadState((current) => ({
      followups: background ? current.followups : [],
      loaded: background ? current.loaded : false,
      loading: background ? current.loading || !current.loaded : true,
      refreshing: background,
      error: null,
    }))

    try {
      const followups = await listByLead(leadId)
      return handleLoadSuccess(request, followups) ? followups : null
    } catch (cause) {
      handleLoadError(request, cause, background)
      return null
    }
  }, [handleLoadError, handleLoadSuccess, leadId])

  // Leitura só de validação, antes de gravar: não pinta nem invalida a requisição em curso,
  // então duas linhas mutando ao mesmo tempo não cancelam a recarga uma da outra.
  const validateLatest = useCallback(async (): Promise<Followup[] | null> => {
    if (!activeRef.current) return null
    try {
      return await listByLead(leadId)
    } catch (cause) {
      if (activeRef.current) {
        toast(cause instanceof Error ? cause.message : 'Erro ao carregar follow-ups.', 'error')
      }
      return null
    }
  }, [leadId, toast])

  useEffect(() => {
    activeRef.current = true
    const request = ++requestRef.current
    void listByLead(leadId).then(
      (followups) => handleLoadSuccess(request, followups),
      (cause: unknown) => handleLoadError(request, cause, false),
    )
    return () => {
      activeRef.current = false
      requestRef.current += 1
    }
  }, [handleLoadError, handleLoadSuccess, leadId])

  useEffect(() => {
    if (lastRefreshKeyRef.current === refreshKey) return
    lastRefreshKeyRef.current = refreshKey
    void load(true)
  }, [load, refreshKey])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const handleUpdated = useCallback((followup: Followup) => {
    requestRef.current += 1
    setLoadState((current) => ({
      ...current,
      followups: current.followups.map((item) => item.id === followup.id ? followup : item),
      refreshing: false,
      error: null,
    }))
  }, [])

  return (
    <Card title="Follow-ups" dot="lime" aria-busy={isBusy}>
      {isBusy && (
        <span role="status" className="sr-only">
          {loadState.loading ? 'Carregando follow-ups…' : 'Atualizando follow-ups…'}
        </span>
      )}

      {loadState.loading ? (
        <Skeleton className="h-32" />
      ) : (
        <div className="flex flex-col gap-3">
          {loadState.error && (
            <div role="alert" className="rounded-xl border border-danger/40 bg-danger/5 p-4">
              <p className="text-sm font-medium text-danger">Não foi possível carregar os follow-ups.</p>
              <p className="mt-1 text-sm text-muted">{loadState.error}</p>
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                disabled={isBusy}
                onClick={() => void load(loadState.loaded)}
              >
                Tentar novamente
              </Button>
            </div>
          )}

          {loadState.loaded && loadState.followups.length === 0 && !loadState.error && (
            <p className="rounded-xl border border-dashed border-line px-3 py-4 text-sm text-muted">
              Nenhum follow-up agendado. Use “Agendar follow-up” para combinar o próximo contato.
            </p>
          )}

          {loadState.followups.length > 0 && (
            <ul className="flex flex-col gap-2" aria-label="Follow-ups do lead">
              {loadState.followups.map((followup) => (
                <FollowupItem
                  key={followup.id}
                  followup={followup}
                  lead={leadName ? { name: leadName } : undefined}
                  loadLatest={validateLatest}
                  onUpdated={handleUpdated}
                  pending={isBusy}
                  now={now}
                  onChanged={onChanged}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
}
