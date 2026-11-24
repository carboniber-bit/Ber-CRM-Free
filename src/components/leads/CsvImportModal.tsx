import { useCallback, useEffect, useRef, useState } from 'react'
import { FileUp } from 'lucide-react'
import { parseLeadsCsv, type CsvParsedRow } from '../../lib/csv'
import { onlyDigits } from '../../lib/format'
import { normalizeLeadDraftForSave, validateLeadDraft } from '../../lib/leadForm'
import { normalizePhoneForComparison } from '../../lib/whatsapp'
import { createLead, findDuplicateCandidates } from '../../services/leadService'
import type { LeadWrite } from '../../types/lead'
import { useToast } from '../../hooks/useToast'
import { cn } from '../../utils/cn'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

interface CsvImportModalProps {
  open: boolean
  onClose: () => void
  onImported: () => void
}

interface RowState extends CsvParsedRow {
  duplicateName?: string
  duplicateLine?: number
}

type ReportResult = 'imported' | 'skipped' | 'failed'

interface ReportEntry {
  line: number
  name: string
  result: ReportResult
  reason: string
}

interface ImportReport {
  imported: number
  skipped: number
  failed: number
  entries: ReportEntry[]
}

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function duplicateKeys(draft: LeadWrite): string[] {
  const keys: string[] = []
  const phone = normalizePhoneForComparison(draft.phone ?? '')
  const whatsapp = normalizePhoneForComparison(draft.whatsapp ?? '')
  const cnpj = onlyDigits(draft.cnpj ?? '')
  const name = draft.name.trim().toLowerCase()
  const city = (draft.city ?? '').trim().toLowerCase()

  if (phone) keys.push(`phone:${phone}`)
  if (whatsapp) keys.push(`whatsapp:${whatsapp}`)
  if (cnpj) keys.push(`cnpj:${cnpj}`)
  if (name && city) keys.push(`name-city:${name}\u0000${city}`)
  return keys
}

function firstDuplicateLine(draft: LeadWrite, previous: Map<string, number>): number | undefined {
  for (const key of duplicateKeys(draft)) {
    const line = previous.get(key)
    if (line !== undefined) return line
  }
  return undefined
}

function registerDuplicate(draft: LeadWrite, line: number, previous: Map<string, number>) {
  for (const key of duplicateKeys(draft)) {
    if (!previous.has(key)) previous.set(key, line)
  }
}

const REPORT_LABELS: Record<ReportResult, string> = {
  imported: 'Importado',
  skipped: 'Ignorado',
  failed: 'Erro',
}

export function CsvImportModal(props: CsvImportModalProps) {
  return <CsvImportModalContent key={props.open ? 'open' : 'closed'} {...props} />
}

function CsvImportModalContent({ open, onClose, onImported }: CsvImportModalProps) {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const mountedRef = useRef(true)
  const generationRef = useRef(0)
  const parsingRef = useRef(false)
  const importingRef = useRef(false)
  const [rows, setRows] = useState<RowState[]>([])
  const [fileName, setFileName] = useState('')
  const [includeDuplicates, setIncludeDuplicates] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)

  const resetState = useCallback(() => {
    generationRef.current += 1
    setRows([])
    setFileName('')
    setReport(null)
    setParseError(null)
    setIncludeDuplicates(false)
    setParsing(false)
    setProgress('')
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      generationRef.current += 1
      parsingRef.current = false
      importingRef.current = false
    }
  }, [])

  const requestClose = () => {
    if (parsingRef.current || importingRef.current) return
    resetState()
    onClose()
  }

  const handleFile = async (file: File) => {
    if (importingRef.current) return
    const generation = ++generationRef.current
    const isCurrent = () => mountedRef.current && generationRef.current === generation

    parsingRef.current = true
    setParsing(true)
    setProgress('Lendo o arquivo CSV...')
    setParseError(null)
    setReport(null)
    setRows([])
    setFileName(file.name)
    setIncludeDuplicates(false)

    try {
      const text = await file.text()
      if (!isCurrent()) return
      const parsed = parseLeadsCsv(text)
      if (parsed.length === 0) {
        setParseError('Nenhuma linha encontrada no arquivo CSV. Verifique o conteúdo e tente novamente.')
        return
      }

      setProgress('Validando os campos do formulário...')
      const previous = new Map<string, number>()
      const validated: RowState[] = parsed.map((row) => {
        if (!row.draft) return { ...row }
        const validationErrors = Object.values(validateLeadDraft(row.draft))
          .filter((message): message is string => Boolean(message))
        const next: RowState = {
          ...row,
          draft: normalizeLeadDraftForSave(row.draft),
          errors: [...row.errors, ...validationErrors],
        }
        if (next.errors.length === 0 && next.draft) {
          const duplicateLine = firstDuplicateLine(next.draft, previous)
          if (duplicateLine !== undefined) next.duplicateLine = duplicateLine
          registerDuplicate(next.draft, next.line, previous)
        }
        return next
      })

      const checked: RowState[] = []
      for (const row of validated) {
        if (!isCurrent()) return
        if (row.draft && row.errors.length === 0 && row.duplicateLine === undefined) {
          setProgress(`Verificando duplicidades da linha ${row.line}...`)
          try {
            const candidates = await findDuplicateCandidates({
              phone: row.draft.phone,
              whatsapp: row.draft.whatsapp,
              cnpj: row.draft.cnpj,
              name: row.draft.name,
              city: row.draft.city,
            })
            if (!isCurrent()) return
            checked.push({ ...row, duplicateName: candidates[0]?.name })
          } catch (error) {
            if (!isCurrent()) return
            checked.push({
              ...row,
              errors: [...row.errors, `Não foi possível verificar duplicidades: ${messageFrom(error, 'erro desconhecido')}. Escolha o arquivo novamente para tentar.`],
            })
          }
        } else {
          checked.push(row)
        }
        setRows([...checked])
      }
      if (isCurrent()) setRows(checked)
    } catch (error) {
      if (isCurrent()) {
        setRows([])
        setParseError(`Não foi possível processar o arquivo CSV: ${messageFrom(error, 'erro desconhecido')}.`)
      }
    } finally {
      if (isCurrent()) {
        parsingRef.current = false
        setParsing(false)
        setProgress('')
      }
    }
  }

  const runImport = async () => {
    if (parsingRef.current || importingRef.current) return
    const generation = ++generationRef.current
    const isCurrent = () => mountedRef.current && generationRef.current === generation
    const allowExistingDuplicates = includeDuplicates
    const entries: ReportEntry[] = []
    let imported = 0
    let skipped = 0
    let failed = 0

    importingRef.current = true
    setImporting(true)
    setParseError(null)
    setProgress('Preparando a importação...')

    try {
      for (const row of rows) {
        if (!isCurrent()) return
        setProgress(`Importando CSV... linha ${row.line} de ${rows.length}.`)
        const name = row.draft?.name ?? '—'

        if (!row.draft || row.errors.length > 0) {
          failed += 1
          entries.push({ line: row.line, name, result: 'failed', reason: row.errors.join(' ') || 'Linha inválida.' })
          continue
        }
        if (row.duplicateLine !== undefined) {
          skipped += 1
          entries.push({
            line: row.line,
            name,
            result: 'skipped',
            reason: `Duplicada no arquivo; primeira ocorrência na linha ${row.duplicateLine}. Esta linha é sempre ignorada.`,
          })
          continue
        }
        if (row.duplicateName && !allowExistingDuplicates) {
          skipped += 1
          entries.push({ line: row.line, name, result: 'skipped', reason: `Duplicado existente: "${row.duplicateName}".` })
          continue
        }

        try {
          const candidates = await findDuplicateCandidates({
            phone: row.draft.phone,
            whatsapp: row.draft.whatsapp,
            cnpj: row.draft.cnpj,
            name: row.draft.name,
            city: row.draft.city,
          })
          if (!isCurrent()) return
          const duplicate = candidates[0]
          if (duplicate && !allowExistingDuplicates) {
            skipped += 1
            entries.push({ line: row.line, name, result: 'skipped', reason: `Duplicado existente: "${duplicate.name}".` })
            continue
          }

          await createLead(normalizeLeadDraftForSave(row.draft))
          if (!isCurrent()) return
          imported += 1
          entries.push({ line: row.line, name, result: 'imported', reason: 'Lead criado.' })
        } catch (error) {
          if (!isCurrent()) return
          failed += 1
          entries.push({
            line: row.line,
            name,
            result: 'failed',
            reason: `Não foi possível importar: ${messageFrom(error, 'erro desconhecido')}.`,
          })
        }
      }

      if (!isCurrent()) return
      const nextReport = { imported, skipped, failed, entries }
      setReport(nextReport)
      const summary = `${imported} importado(s) · ${skipped} ignorado(s) · ${failed} com erro.`
      if (imported > 0) {
        toast(summary, failed > 0 ? 'info' : 'success')
        onImported()
      } else {
        toast(`Nenhum lead importado. ${summary}`, failed > 0 ? 'error' : 'info')
      }
    } finally {
      importingRef.current = false
      if (mountedRef.current) {
        setImporting(false)
        setProgress('')
      }
    }
  }

  const validCount = rows.filter((row) => (
    row.draft
    && row.errors.length === 0
    && row.duplicateLine === undefined
    && (!row.duplicateName || includeDuplicates)
  )).length
  const processableCount = rows.filter((row) => row.draft && row.errors.length === 0).length
  const busy = parsing || importing

  return (
    <Modal open={open} onClose={requestClose} title="Importar leads por CSV" wide dismissible={!busy}>
      <div className="flex min-w-0 flex-col gap-4" aria-busy={busy}>
        <p className="text-sm text-muted">
          Colunas aceitas: nome (obrigatória), responsavel, nicho, telefone, whatsapp, email, cnpj, instagram, facebook, site, cardapio_url, catalogo_url, pais, estado, cidade, bairro, endereco, cep, status, servico, valor_estimado, observacoes, origem, tem_site, tem_instagram, tem_facebook, tem_cardapio, tem_catalogo, tem_landing, tem_whatsapp_comercial. Presença: sim / não / não verificado.
        </p>

        <div>
          <label htmlFor="csv-import-file" className="mb-2 block text-sm font-medium text-ink">Arquivo CSV</label>
          <input
            ref={fileRef}
            id="csv-import-file"
            type="file"
            accept=".csv,text/csv"
            disabled={importing}
            className="block w-full min-w-0 rounded-xl border border-line bg-surface p-2 text-sm text-muted file:mb-2 file:block file:w-full file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-bg sm:file:mb-0 sm:file:inline-block sm:file:w-auto"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleFile(file)
            }}
          />
          <p className="mt-2 text-xs text-muted">Durante a leitura, escolher outro arquivo substitui a seleção anterior.</p>
        </div>

        {fileName && (
          <p className="break-all text-xs text-muted">Arquivo: {fileName} · {rows.length} linha(s)</p>
        )}

        {busy && (
          <p role="status" aria-live="polite" className="rounded-xl border border-line bg-elevated p-3 text-sm text-muted">
            {progress}
          </p>
        )}

        {parseError && (
          <div role="alert" className="rounded-xl border border-danger/40 bg-danger/5 p-3 text-sm text-danger">
            {parseError}
          </div>
        )}

        {rows.length > 0 && !report && (
          <>
            <div className="max-h-64 max-w-full overflow-auto rounded-xl border border-line">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="sticky top-0 bg-elevated text-muted">
                  <tr>
                    <th scope="col" className="w-14 px-3 py-2 font-medium">Linha</th>
                    <th scope="col" className="w-24 px-3 py-2 font-medium sm:w-40">Nome</th>
                    <th scope="col" className="px-3 py-2 font-medium">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const hasError = row.errors.length > 0
                    const isFileDuplicate = !hasError && row.duplicateLine !== undefined
                    const isExistingDuplicate = !hasError && !isFileDuplicate && Boolean(row.duplicateName)
                    const status = hasError ? 'Erro' : isFileDuplicate || isExistingDuplicate ? 'Duplicado' : 'OK'
                    const reason = hasError
                      ? row.errors.join(' ')
                      : isFileDuplicate
                        ? `Primeira ocorrência na linha ${row.duplicateLine}; esta linha será sempre ignorada.`
                        : isExistingDuplicate
                          ? `Já existe "${row.duplicateName}". Será ignorada por padrão.`
                          : 'Pronta para importar.'
                    return (
                      <tr key={row.line} className="border-t border-line/50">
                        <td className="px-3 py-2 text-muted">{row.line}</td>
                        <td className="break-all px-3 py-2 text-ink">{row.draft?.name ?? '—'}</td>
                        <td className="px-3 py-2">
                          <span className={cn(
                            'font-medium',
                            hasError ? 'text-danger' : isFileDuplicate || isExistingDuplicate ? 'text-lime' : 'text-primary',
                          )}>{status}</span>
                          <p className="mt-1 break-all text-muted">{reason}</p>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div>
              <label htmlFor="csv-include-duplicates" className="flex items-center gap-2 text-sm text-ink">
                <input
                  id="csv-include-duplicates"
                  type="checkbox"
                  checked={includeDuplicates}
                  disabled={busy}
                  onChange={(event) => setIncludeDuplicates(event.target.checked)}
                  className="h-4 w-4 shrink-0 accent-[#22c55e]"
                />
                Incluir duplicados
              </label>
              <p className="mt-1 text-xs text-muted">Permite importar somente duplicados já cadastrados. Repetições dentro do arquivo continuam sempre ignoradas.</p>
            </div>
          </>
        )}

        {report && (
          <section
            role={report.failed > 0 ? 'alert' : 'status'}
            aria-live="polite"
            aria-atomic="true"
            aria-busy={false}
            className="rounded-xl border border-primary/40 bg-primary/5 p-4 text-sm"
          >
            <p className="font-medium text-primary">Importação concluída</p>
            <p className="mt-1 text-muted">{report.imported} importado(s) · {report.skipped} ignorado(s) · {report.failed} com erro.</p>
            <div className="mt-3 max-w-full overflow-auto rounded-xl border border-line">
              <table className="w-full min-w-[30rem] text-left text-xs">
                <thead className="bg-elevated text-muted">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Linha</th>
                    <th scope="col" className="px-3 py-2 font-medium">Nome</th>
                    <th scope="col" className="px-3 py-2 font-medium">Resultado</th>
                    <th scope="col" className="px-3 py-2 font-medium">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {report.entries.map((entry) => (
                    <tr key={`${entry.line}-${entry.result}`} className="border-t border-line/50">
                      <td className="px-3 py-2 text-muted">{entry.line}</td>
                      <td className="break-all px-3 py-2 text-ink">{entry.name}</td>
                      <td className={cn(
                        'px-3 py-2 font-medium',
                        entry.result === 'failed' ? 'text-danger' : entry.result === 'skipped' ? 'text-lime' : 'text-primary',
                      )}>{REPORT_LABELS[entry.result]}</td>
                      <td className="break-all px-3 py-2 text-muted">{entry.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" className="w-full sm:w-auto" onClick={requestClose} disabled={busy}>
            {report ? 'Fechar' : 'Cancelar'}
          </Button>
          {rows.length > 0 && !report && (
            <Button
              variant="mint"
              className="w-full sm:w-auto"
              loading={importing}
              disabled={busy || processableCount === 0}
              onClick={() => void runImport()}
            >
              <FileUp className="h-4 w-4" /> Importar {validCount} lead(s)
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
