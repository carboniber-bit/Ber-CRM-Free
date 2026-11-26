import { useNavigate } from 'react-router-dom'
import { ClientForm } from '../components/clients/ClientForm'
import { Card } from '../components/ui/Card'
import { useToast } from '../hooks/useToast'
import type { Client } from '../types/client'

export function ClientNewPage() {
  const navigate = useNavigate()
  const { toast } = useToast()

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Novo cliente</h1>
        <p className="mt-1 text-sm text-muted">Cadastre o cliente e o contrato inicial na mesma operação.</p>
      </div>
      <Card>
        <ClientForm
          mode="create"
          onCancel={() => navigate('/clientes')}
          onSaved={(client: Client) => {
            toast('Cliente cadastrado.')
            navigate(`/clientes/${client.id}`)
          }}
        />
      </Card>
    </div>
  )
}
