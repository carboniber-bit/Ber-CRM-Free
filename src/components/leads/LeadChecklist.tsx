import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import { listChecks, setCheck } from '../../services/digitalCheckService'
import { CHECK_ITEMS, CHECK_LABELS, type CheckItem, type DigitalCheck } from '../../types/check'
import { formatDateTime } from '../../lib/format'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Skeleton } from '../ui/Skeleton'
import { Spinner } from '../ui/Spinner'
import { useToast } from '../../hooks/useToast'
import { cn } from '../../utils/cn'

interface LeadChecklistProps {
  leadId: string
  onChanged: () => void
}

interface ChecklistLoadState {
  checks: DigitalCheck[]
  loaded: boolean
  loading: boolean
  refreshing: boolean
  error: string | null
}

interface MutationError {
  item: CheckItem
  verified: boolean
  message: string
}

export function LeadChecklist({ leadId, onChanged }: LeadChecklistProps) {
  return <LeadChecklistContent key={leadId} leadId={leadId} onChanged={onChanged} />
}

function LeadChecklistContent({ leadId, onChanged }: LeadChecklistProps) {
  const { toast } = useToast()
  const [loadState, setLoadState] = useState<ChecklistLoadState>({
    checks: [],
    loaded: false,
    loading: true,
    refreshing: false,
    error: null,
  })
  const [busy, setBusy] = useState<CheckItem | null>(null)
  const [mutationError, setMutationError] = useState<MutationError | null>(null)
  const requestRef = useRef(0)
  const activeRef = useRef(true)

  const load = useCallback(async (background = false): Promise<boolean> => {
    if (!activeRef.current) return false
    const request = ++requestRef.current
    setLoadState((current) => ({
      checks: background ? current.checks : [],
      loaded: background ? current.loaded : false,
      loading: background ? current.loading : true,
      refreshing: background,
      error: null,
    }))

    try {
      const checks = await listChecks(leadId)
      if (!activeRef.current || request !== requestRef.current) return false
      setLoadState({ checks, loaded: true, loading: false, refreshing: false, error: null })
      return true
    } catch (error) {
      if (!activeRef.current || request !== requestRef.current) return false
      const message = error instanceof Error ? error.message : 'Erro ao carregar checklist.'
      setLoadState((current) => ({
        checks: background ? current.checks : [],
        loaded: background ? current.loaded : false,
        loading: false,
        refreshing: false,
        error: message,
      }))
      toast(message, 'error')
      return false
    }
  }, [leadId, toast])

  useEffect(() => {
    activeRef.current = true
    const request = ++requestRef.current
    void listChecks(leadId).then(
      (checks) => {
        if (!activeRef.current || request !== requestRef.current) return
        setLoadState({ checks, loaded: true, loading: false, refreshing: false, error: null })
      },
      (error: unknown) => {
        if (!activeRef.current || request !== requestRef.current) return
        const message = error instanceof Error ? error.message : 'Erro ao carregar checklist.'
        setLoadState({ checks: [], loaded: false, loading: false, refreshing: false, error: message })
        toast(message, 'error')
      },
    )
    return () => {
      activeRef.current = false
      requestRef.current += 1
    }
  }, [leadId, toast])

  const isBusy = loadState.loading || loadState.refreshing || busy !== null
  const disabled = !loadState.loaded || isBusy || loadState.error !== null
  const byItem = new Map(loadState.checks.map((check) => [check.item, check]))

  const toggle = async (item: CheckItem, verified: boolean) => {
    if (disabled) return
    setBusy(item)
    setMutationError(null)

    try {
      await setCheck(leadId, item, verified)
    } catch (error) {
      if (!activeRef.current) return
      const message = error instanceof Error ? error.message : 'Erro ao atualizar verificação.'
      setMutationError({ item, verified, message })
      toast(message, 'error')
      setBusy(null)
      return
    }

    if (!activeRef.current) return
    onChanged()
    try {
      await load(true)
    } finally {
      if (activeRef.current) setBusy(null)
    }
  }

  const retryMutation = () => {
    if (!mutationError || disabled) return
    const { item, verified } = mutationError
    setMutationError(null)
    void toggle(item, verified)
  }

  return (
    <Card
      title="Checklist de verificação digital"
      dot="accent"
      aria-busy={isBusy}
    >
      {isBusy && (
        <span role="status" className="sr-only">
          {loadState.loading
            ? 'Carregando checklist…'
            : loadState.refreshing
              ? 'Atualizando checklist…'
              : 'Atualizando verificação…'}
        </span>
      )}

      {loadState.loading ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="flex flex-col gap-3">
          {loadState.error && (
            <div className="rounded-xl border border-danger/40 bg-danger/5 p-4" role="alert">
              <p className="text-sm font-medium text-danger">Não foi possível carregar o checklist.</p>
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

          {mutationError && (
            <div className="rounded-xl border border-danger/40 bg-danger/5 p-4" role="alert">
              <p className="text-sm font-medium text-danger">Não foi possível atualizar a verificação.</p>
              <p className="mt-1 text-sm text-muted">{mutationError.message}</p>
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                disabled={disabled}
                onClick={retryMutation}
              >
                Tentar novamente
              </Button>
            </div>
          )}

          {loadState.loaded && loadState.checks.length === 0 && !loadState.error && (
            <p className="rounded-xl border border-dashed border-line px-3 py-4 text-sm text-muted">
              Nenhuma verificação registrada. Marque os itens abaixo conforme forem confirmados.
            </p>
          )}

          {loadState.loaded && (
            <ul className="flex flex-col gap-1" aria-label="Itens do checklist de verificação digital">
              {CHECK_ITEMS.map((item) => {
                const check = byItem.get(item)
                const verified = check?.verified ?? false
                return (
                  <li key={item}>
                    <button
                      type="button"
                      aria-pressed={verified}
                      onClick={() => void toggle(item, !verified)}
                      disabled={disabled}
                      className={cn(
                        'flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-elevated',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                        'disabled:pointer-events-none disabled:opacity-60',
                        verified ? 'text-ink' : 'text-muted',
                      )}
                    >
                      {verified
                        ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        : <Circle className="h-4 w-4 shrink-0" aria-hidden="true" />}
                      <span className="min-w-0 flex-1">{CHECK_LABELS[item]}</span>
                      <span className="sr-only">{verified ? 'Verificado' : 'Não verificado'}</span>
                      {verified && check?.verified_at && (
                        <span className="text-xs text-muted">{formatDateTime(check.verified_at)}</span>
                      )}
                      {busy === item && <Spinner className="h-3.5 w-3.5 text-current" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
}
