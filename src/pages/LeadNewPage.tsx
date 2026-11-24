import { useNavigate } from 'react-router-dom'
import { LeadForm } from '../components/leads/LeadForm'
import { Card } from '../components/ui/Card'
import { useToast } from '../hooks/useToast'

export function LeadNewPage() {
  const navigate = useNavigate()
  const { toast } = useToast()

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <h1 className="font-display text-xl font-bold text-ink">Novo lead</h1>
      <Card>
        <LeadForm
          onSaved={(lead) => {
            toast('Lead cadastrado com sucesso.')
            navigate(`/leads/${lead.id}`)
          }}
          onCancel={() => navigate('/leads')}
        />
      </Card>
    </div>
  )
}
