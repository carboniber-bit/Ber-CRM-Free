import { Link } from 'react-router-dom'
import { ArrowLeft, BarChart3, FolderKanban, Users, Wallet, type LucideIcon } from 'lucide-react'
import { EmptyState } from '../components/ui/EmptyState'

const MODULES = {
  clientes: {
    title: 'Clientes',
    description: 'Leads convertidos virão para cá na Etapa 3, com contratos e histórico completo. Nenhum lead é contado como cliente antes da conversão.',
    stage: 'Etapa 3',
    icon: Users,
  },
  projetos: {
    title: 'Projetos',
    description: 'Acompanhamento dos serviços contratados (site, cardápio, catálogo) chega na Etapa 3.',
    stage: 'Etapa 3',
    icon: FolderKanban,
  },
  financeiro: {
    title: 'Financeiro',
    description: 'Valores contratados e recebidos, separados dos estimados, chegam na Etapa 4.',
    stage: 'Etapa 4',
    icon: Wallet,
  },
  relatorios: {
    title: 'Relatórios',
    description: 'Relatórios de conversão, nichos e desempenho chegam na Etapa 4.',
    stage: 'Etapa 4',
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
