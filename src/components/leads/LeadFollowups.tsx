import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Check, X } from 'lucide-react'
import { cancelFollowup, completeFollowup, listByLead } from '../../services/followupService'
import { FOLLOWUP_STATUS_LABELS, type Followup } from '../../types/followup'
import { formatDateTime } from '../../lib/format'
import { useToast } from '../../hooks/useToast'
import { cn } from '../../utils/cn'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Input } from '../ui/Input'
import { Skeleton } from '../ui/Skeleton'

interface LeadFollowupsProps {
  leadId: string
  refreshKey: number
  onChanged: () => void
}

interface FollowupsLoadState {
  followups: Followup[]
  loaded: boolean
  loading: boolean
  refreshing: boolean
  error: string | null
}

interface MutationError {
  action: 'complete' | 'cancel'
  followup: Followup
  result: string | null
  message: string
}

export function LeadFollowups(props: LeadFollowupsProps) {
  return <LeadFollowupsContent key={props.leadId} {...props} />
}

function LeadFollowupsContent({ leadId, refreshKey, onChanged }: LeadFollowupsProps) {
  const { toast } = useToast()
  const [loadState, setLoadState] = useState<FollowupsLoadState>({
    followups: [],
    loaded: false,
    loading: true,
    refreshing: false,
    error: null,
  })
  const [completing, setCompleting] = useState<Followup | null>(null)
  const [result, setResult] = useState('')
  const [canceling, setCanceling] = useState<Followup | null>(null)
  const [busy, setBusy] = useState<'complete' | 'cancel' | null>(null)
  const [mutationError, setMutationError] = useState<MutationError | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const requestRef = useRef(0)
  const activeRef = useRef(true)
  const operationRef = useRef<'complete' | 'cancel' | null>(null)
  const lastRefreshKeyRef = useRef(refreshKey)
  const isBusy = busy !== null || loadState.loading || loadState.refreshing

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
      operationRef.current = null
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

  const updateLocalFollowup = (followup: Followup) => {
    requestRef.current += 1
    setLoadState((current) => ({
      ...current,
      followups: current.followups.map((item) => item.id === followup.id ? followup : item),
      refreshing: false,
      error: null,
    }))
  }

  const rejectObsoleteMutation = (action: 'complete' | 'cancel') => {
    if (action === 'complete') {
      setCompleting(null)
      setResult('')
    } else {
      setCanceling(null)
    }
    setMutationError(null)
    toast('Este follow-up não está mais pendente. Nenhuma alteração foi feita.', 'info')
  }

  const complete = async (followup: Followup, followupResult: string | null) => {
    if (operationRef.current || isBusy) return
    operationRef.current = 'complete'
    setBusy('complete')
    setMutationError(null)
    let latest: Followup | null = null

    try {
      const latestFollowups = await load(true)
      if (!activeRef.current) return
      if (!latestFollowups) {
        setMutationError({
          action: 'complete',
          followup,
          result: followupResult,
          message: 'Não foi possível validar o estado atual do follow-up. Tente novamente.',
        })
        return
      }
      latest = latestFollowups.find((item) => item.id === followup.id) ?? null
      if (!latest || latest.status !== 'pendente') {
        rejectObsoleteMutation('complete')
        return
      }
      const updated = await completeFollowup(latest.id, followupResult)
      if (!updated) {
        rejectObsoleteMutation('complete')
        return
      }
      latest = updated
    } catch (cause) {
      if (!activeRef.current) return
      const message = cause instanceof Error ? cause.message : 'Erro ao concluir follow-up.'
      setMutationError({ action: 'complete', followup, result: followupResult, message })
      toast(message, 'error')
      return
    } finally {
      operationRef.current = null
      if (activeRef.current) setBusy(null)
    }

    if (!activeRef.current) return
    updateLocalFollowup(latest)
    setCompleting(null)
    setResult('')
    toast('Follow-up concluído.')
    onChanged()
  }

  const cancel = async (followup: Followup) => {
    if (operationRef.current || isBusy) return
    operationRef.current = 'cancel'
    setBusy('cancel')
    setMutationError(null)
    let latest: Followup | null = null

    try {
      const latestFollowups = await load(true)
      if (!activeRef.current) return
      if (!latestFollowups) {
        setCanceling(null)
        setMutationError({
          action: 'cancel',
          followup,
          result: null,
          message: 'Não foi possível validar o estado atual do follow-up. Tente novamente.',
        })
        return
      }
      latest = latestFollowups.find((item) => item.id === followup.id) ?? null
      if (!latest || latest.status !== 'pendente') {
        rejectObsoleteMutation('cancel')
        return
      }
      const updated = await cancelFollowup(latest.id)
      if (!updated) {
        rejectObsoleteMutation('cancel')
        return
      }
      latest = updated
    } catch (cause) {
      if (!activeRef.current) return
      const message = cause instanceof Error ? cause.message : 'Erro ao cancelar follow-up.'
      setCanceling(null)
      setMutationError({ action: 'cancel', followup, result: null, message })
      toast(message, 'error')
      return
    } finally {
      operationRef.current = null
      if (activeRef.current) setBusy(null)
    }

    if (!activeRef.current) return
    updateLocalFollowup(latest)
    setCanceling(null)
    toast('Follow-up cancelado.')
    onChanged()
  }

  const submitCompletion = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!completing || isBusy) return
    void complete(completing, result.trim() || null)
  }

  const closeCompletion = () => {
    if (isBusy) return
    setCompleting(null)
    setResult('')
    setMutationError(null)
  }

  const retryMutation = () => {
    if (!mutationError || isBusy) return
    const failed = mutationError
    setMutationError(null)
    if (failed.action === 'complete') {
      setCanceling(null)
      setCompleting(failed.followup)
      setResult(failed.result ?? '')
      void complete(failed.followup, failed.result)
      return
    }
    setCompleting(null)
    setResult('')
    void cancel(failed.followup)
  }

  return (
    <Card title="Follow-ups" dot="lime" aria-busy={isBusy}>
      {isBusy && (
        <span role="status" className="sr-only">
          {loadState.loading
            ? 'Carregando follow-ups…'
            : loadState.refreshing
              ? 'Atualizando follow-ups…'
              : 'Salvando follow-up…'}
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

          {mutationError?.action === 'cancel' && (
            <div role="alert" className="rounded-xl border border-danger/40 bg-danger/5 p-4">
              <p className="text-sm font-medium text-danger">Não foi possível cancelar o follow-up.</p>
              <p className="mt-1 text-sm text-muted">{mutationError.message}</p>
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                disabled={isBusy}
                onClick={retryMutation}
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
              {loadState.followups.map((followup) => {
                const overdue = followup.status === 'pendente' && new Date(followup.due_at).getTime() < now
                return (
                  <li
                    key={followup.id}
                    className={cn(
                      'rounded-xl border p-3',
                      overdue ? 'border-danger/40 bg-danger/5' : 'border-line bg-elevated',
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <time
                        dateTime={followup.due_at}
                        className={cn('text-sm font-medium', overdue ? 'text-danger' : 'text-ink')}
                      >
                        {formatDateTime(followup.due_at)} {overdue && '· atrasado'}
                      </time>
                      <span className={cn(
                        'text-xs',
                        followup.status === 'concluido' ? 'text-primary' : 'text-muted',
                      )}>
                        {FOLLOWUP_STATUS_LABELS[followup.status]}
                      </span>
                    </div>
                    {followup.reason && <p className="mt-1 break-words text-xs text-muted">{followup.reason}</p>}
                    {followup.note && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted">{followup.note}</p>}
                    {followup.result && <p className="mt-1 break-words text-xs text-muted">Resultado: {followup.result}</p>}
                    {followup.status === 'pendente' && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 px-2.5 text-xs"
                          aria-label={`Concluir follow-up de ${formatDateTime(followup.due_at)}`}
                          disabled={isBusy}
                          onClick={() => {
                            setCanceling(null)
                            setCompleting(followup)
                            setResult('')
                            setMutationError(null)
                          }}
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" /> Concluir
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 px-2.5 text-xs"
                          aria-label={`Cancelar follow-up de ${formatDateTime(followup.due_at)}`}
                          disabled={isBusy}
                          onClick={() => {
                            setCompleting(null)
                            setResult('')
                            setMutationError(null)
                            setCanceling(followup)
                          }}
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" /> Cancelar
                        </Button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {completing && (
        <form onSubmit={submitCompletion} className="mt-3 flex flex-col gap-3 rounded-xl border border-line bg-elevated p-3" aria-busy={busy === 'complete'}>
          <Input
            label="Resultado do follow-up (opcional)"
            value={result}
            onChange={(event) => setResult(event.target.value)}
            placeholder="Ex.: pediu para retornar sexta"
            disabled={isBusy}
          />
          {mutationError?.action === 'complete' && (
            <div role="alert" className="rounded-xl border border-danger/40 bg-danger/5 p-3">
              <p className="text-sm font-medium text-danger">Não foi possível concluir o follow-up.</p>
              <p className="mt-1 text-sm text-muted">{mutationError.message}</p>
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                disabled={isBusy}
                onClick={retryMutation}
              >
                Tentar novamente
              </Button>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closeCompletion} disabled={isBusy}>Voltar</Button>
            <Button type="submit" variant="mint" loading={busy === 'complete'} disabled={isBusy}>
              Confirmar conclusão
            </Button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={canceling !== null}
        title="Cancelar follow-up"
        description="Cancelar este follow-up? Ele deixará de aparecer nas listas de pendentes."
        confirmLabel="Cancelar follow-up"
        loading={isBusy}
        onConfirm={() => {
          if (canceling) void cancel(canceling)
        }}
        onCancel={() => {
          if (isBusy) return
          setCanceling(null)
          setMutationError(null)
        }}
      />
    </Card>
  )
}
