import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { cancelFollowup, completeFollowup } from '../../services/followupService'
import { FOLLOWUP_STATUS_LABELS, type Followup } from '../../types/followup'
import { formatDateTime } from '../../lib/format'
import { useToast } from '../../hooks/useToast'
import { cn } from '../../utils/cn'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Input } from '../ui/Input'

export interface FollowupItemProps {
  followup: Followup
  /**
   * Identifica o lead da linha. Sem `href` o nome é texto: dentro da ficha do próprio lead um
   * link para a página atual só repetiria o título.
   */
  lead?: { name: string; href?: string }
  /**
   * Recarga silenciosa do estado atual antes de gravar. Devolve `null` quando não foi possível
   * ler — sem estado confirmado nada é escrito nem anunciado como concluído.
   */
  loadLatest?: () => Promise<Followup[] | null>
  /** Linha confirmada pela RPC, aplicada por quem é dono da lista sem esperar a recarga. */
  onUpdated?: (followup: Followup) => void
  /**
   * Obsolescência confirmada (RPC `null` ou recarga já devolveu a linha resolvida): quem é dono da
   * lista ressincroniza em silêncio. Não substitui `onChanged` — nesse caminho nada foi gravado
   * por esta linha, então nada é anunciado como sucesso.
   */
  onObsolete?: () => void
  /** Lista em trânsito: nenhum controle age sobre uma linha potencialmente obsoleta. */
  pending?: boolean
  /** Base de comparação do atraso: quem renderiza a lista mantém o próprio relógio (tick de 60 s). */
  now: number
  onChanged: () => void
}

interface MutationFailure {
  action: 'complete' | 'cancel'
  target: Followup
  result: string | null
  message: string
}

export function FollowupItem({
  followup, lead, loadLatest, onUpdated, onObsolete, pending = false, now, onChanged,
}: FollowupItemProps) {
  const { toast } = useToast()
  const [completing, setCompleting] = useState(false)
  const [result, setResult] = useState('')
  const [canceling, setCanceling] = useState(false)
  const [busy, setBusy] = useState<'complete' | 'cancel' | null>(null)
  const [mutationError, setMutationError] = useState<MutationFailure | null>(null)
  const activeRef = useRef(true)
  const operationRef = useRef(false)
  // `locked` é o que a tela mostra; `operationRef` é o que bloqueia o segundo disparo no mesmo tick.
  const locked = busy !== null || pending
  const dueLabel = formatDateTime(followup.due_at)
  const overdue = followup.status === 'pendente' && new Date(followup.due_at).getTime() < now

  useEffect(() => {
    activeRef.current = true
    return () => {
      activeRef.current = false
      operationRef.current = false
    }
  }, [])

  const rejectObsolete = (action: 'complete' | 'cancel') => {
    if (action === 'complete') {
      setCompleting(false)
      setResult('')
    } else {
      setCanceling(false)
    }
    setMutationError(null)
    toast('Este follow-up não está mais pendente. Nenhuma alteração foi feita.', 'info')
    // Aviso depois do toast: quem ressincroniza não apaga a informação de que nada foi feito.
    onObsolete?.()
  }

  const complete = async (target: Followup, followupResult: string | null) => {
    if (operationRef.current || locked) return
    operationRef.current = true
    setBusy('complete')
    setMutationError(null)
    let latest: Followup | null = null

    try {
      if (loadLatest) {
        const latestFollowups = await loadLatest()
        if (!activeRef.current) return
        if (!latestFollowups) {
          setMutationError({
            action: 'complete',
            target,
            result: followupResult,
            message: 'Não foi possível validar o estado atual do follow-up. Tente novamente.',
          })
          return
        }
        latest = latestFollowups.find((item) => item.id === target.id) ?? null
        if (!latest || latest.status !== 'pendente') {
          rejectObsolete('complete')
          return
        }
      }
      const updated = await completeFollowup(target.id, followupResult)
      if (!activeRef.current) return
      if (!updated) {
        rejectObsolete('complete')
        return
      }
      latest = updated
    } catch (cause) {
      if (!activeRef.current) return
      const message = cause instanceof Error ? cause.message : 'Erro ao concluir follow-up.'
      setMutationError({ action: 'complete', target, result: followupResult, message })
      toast(message, 'error')
      return
    } finally {
      operationRef.current = false
      if (activeRef.current) setBusy(null)
    }

    if (!activeRef.current || !latest) return
    onUpdated?.(latest)
    setCompleting(false)
    setResult('')
    toast('Follow-up concluído.')
    onChanged()
  }

  const cancel = async (target: Followup) => {
    if (operationRef.current || locked) return
    operationRef.current = true
    setBusy('cancel')
    setMutationError(null)
    let latest: Followup | null = null

    try {
      if (loadLatest) {
        const latestFollowups = await loadLatest()
        if (!activeRef.current) return
        setCanceling(false)
        if (!latestFollowups) {
          setMutationError({
            action: 'cancel',
            target,
            result: null,
            message: 'Não foi possível validar o estado atual do follow-up. Tente novamente.',
          })
          return
        }
        latest = latestFollowups.find((item) => item.id === target.id) ?? null
        if (!latest || latest.status !== 'pendente') {
          rejectObsolete('cancel')
          return
        }
      }
      const updated = await cancelFollowup(target.id)
      if (!activeRef.current) return
      if (!updated) {
        rejectObsolete('cancel')
        return
      }
      latest = updated
    } catch (cause) {
      if (!activeRef.current) return
      const message = cause instanceof Error ? cause.message : 'Erro ao cancelar follow-up.'
      setCanceling(false)
      setMutationError({ action: 'cancel', target, result: null, message })
      toast(message, 'error')
      return
    } finally {
      operationRef.current = false
      if (activeRef.current) setBusy(null)
    }

    if (!activeRef.current || !latest) return
    onUpdated?.(latest)
    setCanceling(false)
    toast('Follow-up cancelado.')
    onChanged()
  }

  const submitCompletion = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!completing || locked) return
    void complete(followup, result.trim() || null)
  }

  const closeCompletion = () => {
    if (locked) return
    setCompleting(false)
    setResult('')
    setMutationError(null)
  }

  const openCompletion = () => {
    if (locked) return
    setCanceling(false)
    setCompleting(true)
    setResult('')
    setMutationError(null)
  }

  const openCancel = () => {
    if (locked) return
    setCompleting(false)
    setResult('')
    setMutationError(null)
    setCanceling(true)
  }

  const retryMutation = () => {
    if (!mutationError || locked) return
    const failed = mutationError
    setMutationError(null)
    if (failed.action === 'complete') {
      setCanceling(false)
      setCompleting(true)
      setResult(failed.result ?? '')
      void complete(failed.target, failed.result)
      return
    }
    setCompleting(false)
    setResult('')
    void cancel(failed.target)
  }

  return (
    <li
      className={cn(
        'rounded-xl border p-3',
        overdue ? 'border-danger/40 bg-danger/5' : 'border-line bg-elevated',
      )}
      aria-busy={locked}
    >
      {busy !== null && <span role="status" className="sr-only">Salvando follow-up…</span>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {lead && (lead.href ? (
            <Link to={lead.href} className="break-words text-sm font-medium text-ink hover:text-primary">
              {lead.name}
            </Link>
          ) : (
            <span className="break-words text-sm font-medium text-ink">{lead.name}</span>
          ))}
          <time
            dateTime={followup.due_at}
            className={cn('text-sm font-medium', overdue ? 'text-danger' : 'text-ink')}
          >
            {dueLabel} {overdue && '· atrasado'}
          </time>
        </div>
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
            aria-label={`Concluir follow-up de ${dueLabel}`}
            disabled={locked}
            onClick={openCompletion}
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" /> Concluir
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-8 px-2.5 text-xs"
            aria-label={`Cancelar follow-up de ${dueLabel}`}
            disabled={locked}
            onClick={openCancel}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" /> Cancelar
          </Button>
        </div>
      )}

      {completing && (
        <form
          onSubmit={submitCompletion}
          className="mt-2 flex flex-col gap-3 rounded-xl border border-line bg-elevated p-3"
          aria-busy={busy === 'complete'}
        >
          <Input
            label="Resultado do follow-up (opcional)"
            value={result}
            onChange={(event) => setResult(event.target.value)}
            placeholder="Ex.: pediu para retornar sexta"
            disabled={locked}
          />
          {mutationError?.action === 'complete' && (
            <div role="alert" className="rounded-xl border border-danger/40 bg-danger/5 p-3">
              <p className="text-sm font-medium text-danger">Não foi possível concluir o follow-up.</p>
              <p className="mt-1 text-sm text-muted">{mutationError.message}</p>
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                disabled={locked}
                onClick={retryMutation}
              >
                Tentar novamente
              </Button>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closeCompletion} disabled={locked}>Voltar</Button>
            <Button type="submit" variant="mint" loading={busy === 'complete'} disabled={locked}>
              Confirmar conclusão
            </Button>
          </div>
        </form>
      )}

      {mutationError?.action === 'cancel' && (
        <div role="alert" className="mt-2 rounded-xl border border-danger/40 bg-danger/5 p-3">
          <p className="text-sm font-medium text-danger">Não foi possível cancelar o follow-up.</p>
          <p className="mt-1 text-sm text-muted">{mutationError.message}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            disabled={locked}
            onClick={retryMutation}
          >
            Tentar novamente
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={canceling}
        title="Cancelar follow-up"
        description="Cancelar este follow-up? Ele deixará de aparecer nas listas de pendentes."
        confirmLabel="Cancelar follow-up"
        loading={locked}
        onConfirm={() => void cancel(followup)}
        onCancel={() => {
          if (locked) return
          setCanceling(false)
          setMutationError(null)
        }}
      />
    </li>
  )
}
