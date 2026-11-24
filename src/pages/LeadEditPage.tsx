import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getLead } from '../services/leadService'
import type { Lead, LeadWrite } from '../types/lead'
import { LeadForm } from '../components/leads/LeadForm'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Skeleton'
import { useToast } from '../hooks/useToast'

interface LeadLoadState {
  id: string
  lead: Lead | null
  error: string | null
}

export function LeadEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [loadState, setLoadState] = useState<LeadLoadState | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!id) return
    let active = true
    void getLead(id).then(
      (lead) => { if (active) setLoadState({ id, lead, error: null }) },
      (error: unknown) => {
        if (active) setLoadState({ id, lead: null, error: error instanceof Error ? error.message : 'Erro ao carregar lead.' })
      },
    )
    return () => { active = false }
  }, [id, reloadKey])

  if (!id) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <h1 className="font-display text-xl font-bold text-ink">Editar lead</h1>
        <Card className="border-danger/40" role="alert">
          <p className="text-sm text-danger">Lead não encontrado.</p>
          <Button variant="outline" className="mt-3" onClick={() => navigate('/leads')}>Voltar para leads</Button>
        </Card>
      </div>
    )
  }

  if (loadState?.id === id && loadState.error) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <h1 className="font-display text-xl font-bold text-ink">Editar lead</h1>
        <Card className="border-danger/40" role="alert">
          <p className="text-sm text-danger">{loadState.error}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" onClick={() => { setLoadState(null); setReloadKey((key) => key + 1) }}>Tentar novamente</Button>
            <Button variant="ghost" onClick={() => navigate('/leads')}>Voltar para leads</Button>
          </div>
        </Card>
      </div>
    )
  }

  if (!loadState || loadState.id !== id || !loadState.lead) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-5" aria-busy="true">
        <h1 className="font-display text-xl font-bold text-ink">Editar lead</h1>
        <Skeleton className="h-96" />
        <span className="sr-only">Carregando lead…</span>
      </div>
    )
  }

  const lead = loadState.lead
  const {
    id: _id,
    owner_id: _ownerId,
    created_at: _createdAt,
    updated_at: _updatedAt,
    next_contact_at: _nextContactAt,
    last_verified_at: _lastVerifiedAt,
    score: _score,
    priority: _priority,
    needs: _needs,
    score_reasons: _scoreReasons,
    ...editable
  } = lead
  const initial: LeadWrite = {
    name: editable.name,
    responsible_name: editable.responsible_name,
    niche: editable.niche,
    phone: editable.phone,
    whatsapp: editable.whatsapp,
    email: editable.email,
    cnpj: editable.cnpj,
    instagram: editable.instagram,
    facebook: editable.facebook,
    website: editable.website,
    menu_url: editable.menu_url,
    catalog_url: editable.catalog_url,
    country: editable.country,
    state: editable.state,
    city: editable.city,
    district: editable.district,
    address: editable.address,
    zip_code: editable.zip_code,
    has_website: editable.has_website,
    has_instagram: editable.has_instagram,
    has_facebook: editable.has_facebook,
    has_digital_menu: editable.has_digital_menu,
    has_digital_catalog: editable.has_digital_catalog,
    has_landing_page: editable.has_landing_page,
    has_business_whatsapp: editable.has_business_whatsapp,
    status: editable.status,
    offered_service: editable.offered_service,
    notes: editable.notes,
    source: editable.source,
    estimated_value: editable.estimated_value,
    negotiated_value: editable.negotiated_value,
    contracted_value: editable.contracted_value,
    received_value: editable.received_value,
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <h1 className="font-display text-xl font-bold text-ink">Editar lead</h1>
      <Card>
        <LeadForm
          initial={initial}
          leadId={lead.id}
          onSaved={() => {
            toast('Alterações salvas.')
            navigate('/leads')
          }}
          onCancel={() => navigate('/leads')}
        />
      </Card>
    </div>
  )
}
