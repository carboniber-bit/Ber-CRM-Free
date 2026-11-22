import { FolderKanban, Rocket, Users, Wallet } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { Card } from '../components/ui/Card'
import { StatusDot, type DotColor } from '../components/ui/StatusDot'

const modules: Array<{ title: string; description: string; icon: typeof Users; dot: DotColor; stage: string }> = [
  {
    title: 'Leads',
    description: 'Cadastro e funil de prospecção de clientes.',
    icon: Users,
    dot: 'accent',
    stage: 'Etapa 2',
  },
  {
    title: 'Projetos',
    description: 'Pipeline de projetos e acompanhamento comercial.',
    icon: FolderKanban,
    dot: 'lime',
    stage: 'Etapa 3',
  },
  {
    title: 'Financeiro',
    description: 'Receitas, despesas e visão de resultados.',
    icon: Wallet,
    dot: 'pink',
    stage: 'Etapa 4',
  },
]

export function DashboardPage() {
  const { user } = useAuth()

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
        <p className="mt-1 text-sm text-muted">Bem-vindo(a), {user?.email}.</p>
      </div>

      <Card title="Fundação concluída" dot="mint">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-mint/15">
            <Rocket className="h-5 w-5 text-mint" />
          </div>
          <div className="text-sm text-muted">
            <p>
              Etapa 1 finalizada: estrutura do projeto, autenticação com Supabase, rotas protegidas e
              schema de perfis com RLS.
            </p>
            <p className="mt-2">
              Os módulos abaixo serão construídos nas próximas etapas, mediante sua autorização.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map(({ title, description, icon: Icon, dot, stage }) => (
          <Card key={title} className="relative">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-elevated">
                <Icon className="h-5 w-5 text-muted" />
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-elevated px-2.5 py-1 text-xs text-muted">
                <StatusDot color={dot} />
                {stage}
              </span>
            </div>
            <h3 className="text-sm font-medium text-ink">{title}</h3>
            <p className="mt-1 text-sm text-muted">{description}</p>
            <p className="mt-3 text-xs text-muted/60">Em breve</p>
          </Card>
        ))}
      </div>
    </div>
  )
}