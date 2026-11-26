import { Link } from 'react-router-dom'
import { ArrowLeft, BarChart3, FolderKanban, Wallet, type LucideIcon } from 'lucide-react'
import { EmptyState } from '../components/ui/EmptyState'

const MODULES = {
  projetos: {
    title: 'Projetos',
    description: 'O módulo Projetos será implementado no Plano 2 da Etapa 3. Até lá, os projetos básicos permanecem na ficha do cliente.',
    stage: 'Etapa 3',
    icon: FolderKanban,
  },
  financeiro: {
    title: 'Financeiro',
    description: 'Valores contratados e recebidos, separados dos estimados, chegam na Etapa 3, pelo Plano 3.',
    stage: 'Etapa 3',
    icon: Wallet,
  },
  relatorios: {
    title: 'Relatórios',
    description: 'Relatórios de conversão, nichos e desempenho chegam na Etapa 3, no plano de finalização.',
    stage: 'Etapa 3',
    icon: BarChart3,
  },
} as const satisfies Record<string, { title: string; description: string; stage: string; icon: LucideIcon }>

export function ModulePlaceholderPage({ moduleKey }: { moduleKey: keyof typeof MODULES }) {
  const selectedModule = MODULES[moduleKey]

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-xl font-bold text-ink">{selectedModule.title}</h1>
      <EmptyState
        icon={selectedModule.icon}
        title={`${selectedModule.title} — disponível na ${selectedModule.stage}`}
        description={selectedModule.description}
        action={(
          <Link
            to="/leads"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-5 text-sm font-medium text-ink transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar para Leads
          </Link>
        )}
      />
    </div>
  )
}
