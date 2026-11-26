import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getLead } from '../services/leadService'
import { getLeadClientLink } from '../services/clientService'
import type { LeadClientLink } from '../types/client'
import type { Lead, LeadWrite } from '../types/lead'
import { LeadForm } from '../components/leads/LeadForm'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Skeleton'
import { useToast } from '../hooks/useToast'

type EditLoadState =
  | { status: 'loading'; id: string }
  | { status: 'ready'; id: string; lead: Lead; link: LeadClientLink | null }
  | { status: 'error'; id: string; message: string }

export function LeadEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [loadState, setLoadState] = useState<EditLoadState | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const activeRef = useRef(true)
  const requestRef = useRef(0)

  const loadLeadAndLink = useCallback(async () => {
    if (!id || !activeRef.current) return
    const request = ++requestRef.current
    setLoadState({ status: 'loading', id })

    const [leadResult, linkResult] = await Promise.allSettled([
      getLead(id),
      getLeadClientLink(id),
    ])
    if (!activeRef.current || request !== requestRef.current) return

    if (leadResult.status === 'rejected') {
      setLoadState({
        status: 'error',
        id,
        message: leadResult.reason instanceof Error ? leadResult.reason.message : 'Erro ao carregar lead.',
      })
      return
    }
    if (linkResult.status === 'rejected') {
      const message = linkResult.reason instanceof Error ? linkResult.reason.message : 'Erro ao consultar vínculo.'
      setLoadState({ status: 'error', id, message: `Não foi possível verificar o vínculo com o cliente. ${message}` })
      return
    }

    setLoadState({ status: 'ready', id, lead: leadResult.value, link: linkResult.value })
  }, [id, reloadKey])

  useEffect(() => {
    activeRef.current = true
    void loadLeadAndLink()
    return () => {
      activeRef.current = false
      requestRef.current += 1
    }
  }, [loadLeadAndLink])

  const retry = () => {
    setLoadState(null)
    setReloadKey((key) => key + 1)
  }

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

  if (!loadState || loadState.id !== id || loadState.status === 'loading') {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-5" aria-busy="true">
        <h1 className="font-display text-xl font-bold text-ink">Editar lead</h1>
        <Skeleton className="h-96" />
        <span role="status" className="sr-only">Carregando lead…</span>
      </div>
    )
  }

  if (loadState.status === 'error') {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <h1 className="font-display text-xl font-bold text-ink">Editar lead</h1>
        <Card className="border-danger/40" role="alert">
          <p className="text-sm text-danger">{loadState.message}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" onClick={retry}>Tentar novamente</Button>
            <Button variant="ghost" onClick={() => navigate('/leads')}>Voltar para leads</Button>
          </div>
        </Card>
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
    maps_url: editable.maps_url,
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
          financialFieldsLocked={Boolean(loadState.link)}
          onSaved={(savedLead) => {
            toast('Alterações salvas.')
            navigate(`/leads/${savedLead.id}`)
          }}
          onCancel={() => navigate('/leads')}
        />
      </Card>
    </div>
  )
}
