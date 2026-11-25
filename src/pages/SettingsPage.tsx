import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { getProfileName, getSettings, saveSettings, updateProfileName } from '../services/settingsService'
import { DEFAULT_SETTINGS, SERVICE_LABELS, type ServicePrices } from '../types/settings'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Skeleton } from '../components/ui/Skeleton'
import { Textarea } from '../components/ui/Textarea'

export function SettingsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [fullName, setFullName] = useState('')
  const [prices, setPrices] = useState<ServicePrices>({ ...DEFAULT_SETTINGS.service_prices })
  const [template, setTemplate] = useState(DEFAULT_SETTINGS.whatsapp_template)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    void Promise.all([getSettings(), getProfileName()])
      .then(([settings, profileName]) => {
        if (!active) return
        setPrices(settings.service_prices)
        setTemplate(settings.whatsapp_template)
        setFullName(profileName)
      })
      .catch((e: unknown) => {
        if (active) toast(e instanceof Error ? e.message : 'Erro ao carregar configurações.', 'error')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [toast])

  const save = async () => {
    setSaving(true)
    try {
      await Promise.all([saveSettings(prices, template), updateProfileName(fullName.trim())])
      toast('Configurações salvas.')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro ao salvar.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Skeleton className="h-96" />

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <h1 className="font-display text-xl font-bold text-ink">Configurações</h1>

      <Card title="Perfil" dot="mint">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Seu nome"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Como você aparece no CRM"
          />
          <Input label="E-mail" value={user?.email ?? ''} disabled />
        </div>
      </Card>

      <Card title="Preços padrão por serviço" dot="lime">
        <p className="mb-3 text-xs text-muted">
          Usados como sugestão de valor estimado ao cadastrar leads. Valores estimados não são faturamento.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(Object.keys(SERVICE_LABELS) as Array<keyof ServicePrices>).map((key) => (
            <Input
              key={key}
              label={`${SERVICE_LABELS[key]} (R$)`}
              type="number"
              min="0"
              step="0.01"
              value={String(prices[key])}
              onChange={(e) => setPrices((current) => ({
                ...current,
                [key]: Math.max(0, Number(e.target.value) || 0),
              }))}
            />
          ))}
        </div>
      </Card>

      <Card title="Mensagem inicial do WhatsApp" dot="accent">
        <Textarea
          label="Template (editável a cada envio)"
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          placeholder="Olá! Sou especializado em sites para negócios locais. Vi que vocês ainda não têm um site e posso ajudar..."
        />
        {template.trim() && (
          <div className="mt-3 rounded-xl border border-line bg-elevated p-3">
            <p className="text-xs text-muted">Preview:</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{template}</p>
          </div>
        )}
        <p className="mt-2 text-xs text-muted">
          O CRM nunca envia mensagens automaticamente. Você revisa e envia manualmente no WhatsApp.
        </p>
      </Card>

      <div className="flex justify-end">
        <Button type="button" variant="mint" loading={saving} onClick={() => void save()}>
          <Save className="h-4 w-4" aria-hidden="true" />
          Salvar configurações
        </Button>
      </div>
    </div>
  )
}
