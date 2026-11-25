import type { ReactNode } from 'react'
import { Card } from '../ui/Card'

/**
 * Moldura de gráfico: altura fixa para o `ResponsiveContainer` medir (sem altura definida o
 * Recharts não renderiza) e o título que diz exatamente o que a série conta.
 */
export function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card title={title} dot="accent">
      <div className="h-56">{children}</div>
    </Card>
  )
}
