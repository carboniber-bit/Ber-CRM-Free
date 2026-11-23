// ScoreBar.tsx
import { priorityFromScore } from '../../lib/opportunity'
import { cn } from '../../utils/cn'

const barColors = {
  muito_alta: 'bg-pink',
  alta: 'bg-lime',
  media: 'bg-accent',
  baixa: 'bg-muted',
} as const

export function ScoreBar({ score, showLabel = true }: { score: number; showLabel?: boolean }) {
  const priority = priorityFromScore(score)
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full min-w-16 overflow-hidden rounded-full bg-elevated">
        <div className={cn('h-full rounded-full transition-all', barColors[priority])} style={{ width: `${score}%` }} />
      </div>
      {showLabel && <span className="w-8 shrink-0 text-right text-xs font-medium text-muted">{score}</span>}
    </div>
  )
}
