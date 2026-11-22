import { cn } from '../../utils/cn'

export type DotColor = 'mint' | 'lime' | 'pink' | 'accent' | 'danger' | 'muted'

const colors: Record<DotColor, string> = {
  mint: 'bg-mint shadow-[0_0_8px_rgba(74,222,128,0.7)]',
  lime: 'bg-lime shadow-[0_0_8px_rgba(254,250,61,0.7)]',
  pink: 'bg-pink shadow-[0_0_8px_rgba(255,93,231,0.7)]',
  accent: 'bg-accent shadow-[0_0_8px_rgba(109,181,255,0.7)]',
  danger: 'bg-danger shadow-[0_0_8px_rgba(248,113,113,0.7)]',
  muted: 'bg-muted/50',
}

export function StatusDot({ color, className }: { color: DotColor; className?: string }) {
  return <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', colors[color], className)} aria-hidden="true" />
}