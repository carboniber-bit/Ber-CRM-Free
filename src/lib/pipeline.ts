import type { UniqueIdentifier } from '@dnd-kit/core'
import { LEAD_STATUSES, type LeadStatus } from '../types/lead'

/**
 * Coluna sobre a qual o card foi solto, ou `null` quando o arraste não confirmou destino.
 *
 * A regra do produto é "status só muda com confirmação", e no Kanban o arraste é essa
 * confirmação — portanto só um drop terminado **dentro de uma coluna** pode gravar. Duas
 * situações viram `null`:
 *
 * - sem `over` (o ponteiro estava fora de todo droppable — fundo da página, cabeçalho,
 *   espaçamento entre colunas); com `pointerWithin` é isso que acontece nesse caso;
 * - `over.id` que não é um status do pipeline (id de outro contexto/droppable estrangeiro):
 *   coercion de id aleatório em `LeadStatus` escreveria um valor que o domínio não conhece.
 *
 * A assinatura é estrutural (`{ id }` só) de propósito: um `DragEndEvent` real é aceito, e nada
 * além do destino é necessário para decidir.
 */
export function statusFromDragEnd(event: { over?: { id: UniqueIdentifier } | null }): LeadStatus | null {
  const id = event.over?.id
  if (typeof id !== 'string') return null
  return (LEAD_STATUSES as readonly string[]).includes(id) ? id as LeadStatus : null
}
