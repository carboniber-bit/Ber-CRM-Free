import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { ToastContext, type ToastContextValue, type ToastKind } from '../../hooks/useToast'
import { cn } from '../../utils/cn'

interface ToastItem {
  id: number
  message: string
  kind: ToastKind
}

let nextId = 1

const icons: Record<ToastKind, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
}

const styles: Record<ToastKind, string> = {
  success: 'border-primary/40 text-primary',
  error: 'border-danger/40 text-danger',
  info: 'border-accent/40 text-accent',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = nextId++
    setItems((current) => [...current, { id, message, kind }])
    setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id))
    }, 4000)
  }, [])

  const value = useMemo<ToastContextValue>(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
        {items.map((item) => {
          const Icon = icons[item.kind]
          return (
            <div
              key={item.id}
              role="status"
              className={cn(
                'pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-elevated p-3.5 text-sm text-ink shadow-lg shadow-black/40',
                styles[item.kind],
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="text-ink">{item.message}</span>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
