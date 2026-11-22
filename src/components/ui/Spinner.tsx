import { LoaderCircle } from 'lucide-react'
import { cn } from '../../utils/cn'

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn('h-5 w-5 animate-spin text-muted', className)} aria-label="Carregando" />
}

export function FullScreenLoader() {
  return (
    <div className="dot-grid flex min-h-screen items-center justify-center bg-bg">
      <Spinner className="h-8 w-8 text-accent" />
    </div>
  )
}