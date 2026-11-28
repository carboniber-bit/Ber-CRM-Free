import { useNavigate } from 'react-router-dom'
import { ProjectForm } from '../components/projects/ProjectForm'
import { Card } from '../components/ui/Card'
import { useToast } from '../hooks/useToast'

export function ProjectNewPage() {
  const navigate = useNavigate()
  const { toast } = useToast()

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-bold text-ink">Novo projeto</h1>
        <p className="mt-1 text-sm text-muted">
          Vincule o projeto a um cliente e um contrato ativo. O prazo sugerido pode ser ajustado.
        </p>
      </div>
      <Card>
        <ProjectForm
          onCancel={() => navigate('/projetos')}
          onSaved={(project) => {
            toast('Projeto cadastrado com sucesso.')
            navigate(`/projetos/${project.id}`)
          }}
        />
      </Card>
    </div>
  )
}
