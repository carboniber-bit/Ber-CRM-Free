# Ber CRM — CRM de Prospecção Comercial

CRM profissional construído por etapas, 100% em planos gratuitos.

**Etapa atual: 3 — Plano 1 (Clientes) implementado; Projetos e Financeiro nos próximos planos.**
O CRM inclui Leads / Prospecção, Oportunidades, Pipeline Kanban, Follow-ups, Dashboard,
Configurações e Clientes. O módulo Clientes possui lista com filtros e paginação,
cadastro com contrato inicial, ficha com projetos básicos, contratos e histórico combinado,
arquivamento confirmado e conversão de leads por vínculo real.
A aplicação das migrations `0006` (Clientes) e `0007` (link exato do Maps) e do teste SQL da Etapa 3 deve ser executada pelo usuário.
O teste de isolamento RLS entre dois usuários permanece pendente até existir uma segunda
conta temporária de teste. Projetos, Financeiro e Relatórios continuam como placeholders
até seus respectivos planos.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- React Router v7
- Supabase Free (PostgreSQL + Auth)
- Lucide Icons · Montserrat (títulos) + Roboto (texto)
- Deploy: Vercel Hobby + GitHub

## Execução local

Pré-requisitos: Node.js 20+ e npm.

```bash
npm install
npm run dev
```

O app abre em `http://localhost:5173`. Sem as chaves do Supabase, o app funciona
em modo diagnóstico: a página `/status` mostra o que falta configurar.

Outros comandos:

```bash
npm test          # testes unitários (Vitest)
npm run build     # typecheck + build de produção (dist/)
npm run preview   # serve o build localmente
npm run lint      # lint
```

## Configuração do Supabase (obrigatório para login)

Projeto Supabase: `nuzjlizqdldhygsliwwc`

1. **Copie a chave pública**: acesse
   [Dashboard → Settings → API Keys](https://supabase.com/dashboard/project/nuzjlizqdldhygsliwwc/settings/api-keys)
   e copie a chave **anon public** (ou a **publishable key**).
2. **Preencha o `.env.local`** na raiz do projeto (já criado, fora do git):

   ```env
   VITE_SUPABASE_URL=https://nuzjlizqdldhygsliwwc.supabase.co
   VITE_SUPABASE_ANON_KEY=<sua chave pública aqui>
   ```

   Reinicie o dev server após editar.
3. **Execute o schema**: abra o [SQL Editor](https://supabase.com/dashboard/project/nuzjlizqdldhygsliwwc/sql/new)
   e execute, nesta ordem, [`0001_profiles.sql`](supabase/migrations/0001_profiles.sql),
   [`0002_etapa2.sql`](supabase/migrations/0002_etapa2.sql),
   [`0003_duplicate_canonical.sql`](supabase/migrations/0003_duplicate_canonical.sql),
   [`0004_followup_atomic.sql`](supabase/migrations/0004_followup_atomic.sql),
   [`0005_followup_rpc_json.sql`](supabase/migrations/0005_followup_rpc_json.sql),
   [`0006_etapa3_clients.sql`](supabase/migrations/0006_etapa3_clients.sql) e
   [`0007_lead_maps_url.sql`](supabase/migrations/0007_lead_maps_url.sql).
   As migrations criam as tabelas privadas, os índices, as políticas RLS e as
   RPCs e triggers transacionais. Depois aplique
   [`supabase/tests/etapa3_clients.sql`](supabase/tests/etapa3_clients.sql) para a
   validação SQL da Etapa 3. A aplicação das migrations e a execução desse teste SQL
   são responsabilidade do usuário; o frontend não as executa automaticamente.
4. **Crie seu usuário**: Dashboard → Authentication → Users → *Add user* →
   informe e-mail e senha (marque *Auto Confirm User*). Não há cadastro público.
5. Acesse `/status` no app para validar tudo, depois faça login em `/login`.

### Segurança

- Apenas a chave **pública** (anon/publishable) é usada no frontend.
  **Nunca** coloque a `service_role` key no `.env.local` ou no código.
- RLS ativo nas tabelas privadas com `owner_id = auth.uid()`; a validação cruzada
  com dois usuários está pendente por falta de uma segunda conta temporária.
- Rotas internas protegidas por sessão; sem sessão → redireciona para `/login`.
- `.env.local` está no `.gitignore` — credenciais nunca vão para o GitHub.

## Estrutura do projeto

```
src/
  components/
    ui/           Button, Input, Card, Modal, Toast, StatusBadge, PresenceBadge, ScoreBar…
    auth/         telas de autenticação
    leads/        LeadForm, LeadFiltersBar, LeadChecklist, OpportunityPanel, LeadTimeline,
                  LeadFollowups, FollowupDialog, ContactDialog, WhatsAppDialog, CsvImportModal,
                  ConversionDialog
    clients/      ClientForm, ClientHistory
    pipeline/     KanbanCard e KanbanColumn
    followups/    FollowupItem
  pages/          LoginPage, DashboardPage, StatusPage, NotFoundPage, LeadsPage,
                  LeadNewPage, LeadDetailPage, LeadEditPage, OpportunitiesPage,
                  PipelinePage, FollowUpsPage, SettingsPage, ClientsPage, ClientNewPage,
                  ClientDetailPage, ModulePlaceholderPage
  layouts/        AuthLayout (login) e AppLayout (app autenticado, sidebar + drawer mobile)
  hooks/          useAuth, useToast
  services/       authService, leadService, activityService, followupService,
                  digitalCheckService, dashboardService, settingsService, clientService
  lib/            supabase.ts (cliente único), db.ts, csv.ts, format.ts, leadForm.ts,
                  money.ts, url.ts, opportunity.ts, whatsapp.ts, dashboard.ts, pipeline.ts
  types/          Profile, Lead, Activity, Followup, Check, Settings, Client, Contract,
                  Project, ClientHistoryEntry, LeadClientLink
  utils/          helpers
  routes/         AppRoutes + ProtectedRoute
supabase/
  migrations/   0001–0007 (profiles, leads, CRM, duplicidades, follow-ups, clientes e Maps)
  tests/        etapa3_clients.sql (validação SQL executada pelo usuário)
```

Rotas protegidas: `/` (dashboard) · `/leads` · `/leads/novo` · `/leads/:id` ·
`/leads/:id/editar` · `/oportunidades` · `/pipeline` · `/followups` · `/configuracoes` ·
`/clientes` · `/clientes/novo` · `/clientes/:id` · `/projetos` · `/financeiro` ·
`/relatorios`. `/login` e `/status` são públicas; rotas desconhecidas exibem a página 404.

## Fluxo de prospecção

1. **Cadastre o lead** com os dados conhecidos. Presença digital usa três estados:
   `sim`, `não` e `não verificado`; desconhecido nunca é tratado como ausência confirmada.
2. **Verifique a presença digital** e edite o lead quando houver nova informação. O score,
   a prioridade e o valor estimado são recalculados a partir dos dados cadastrados.
3. **Consulte Oportunidades** e use filtros combinados para priorizar o trabalho.
4. **Inicie a prospecção** pela ficha do lead existente. O WhatsApp abre um link `wa.me`
   com mensagem editável; o envio continua sendo manual.
5. **Mova o lead no Pipeline** por arraste ou pelo seletor “Mover para”, no desktop e no
   mobile. A mudança fica registrada no histórico.
6. **Agende Follow-ups**, conclua com resultado e acompanhe os atrasados pelo dashboard
   e pelo sino do cabeçalho.

Limites atuais dos planos gratuitos:

- Supabase Free e Vercel Hobby, sem billing, APIs pagas ou automação de mensagens.
- O dashboard usa a contagem exata de leads, mas seus gráficos e indicadores de leads
  (exceto o total) trabalham sobre uma janela de até 1000 registros.
- A lista principal de Oportunidades mostra até 200 registros por consulta; a contagem
  e o potencial indicam quando são parciais. A fila “Prospectar hoje” percorre as páginas
  da consulta elegível antes de ordenar e priorizar. Como usa paginação por offset, escrita
  concorrente durante a leitura pode alterar o conjunto retornado.
- O Pipeline carrega até 500 leads por consulta e a exportação CSV inclui até 1000
  registros da view filtrada; a interface avisa quando há mais resultados.
- Valores estimados não são faturamento nem dinheiro recebido. A ficha do cliente mostra
  projetos básicos e valores contratados; os módulos Projetos, Financeiro e Relatórios
  ainda não foram implementados.

## Deploy na Vercel (plano Hobby, gratuito)

1. Suba o código para o GitHub: repositório
   [carboniber-bit/Ber-CRM-Free](https://github.com/carboniber-bit/Ber-CRM-Free).
2. Em [vercel.com](https://vercel.com) → *Add New → Project* → importe o repositório.
3. Framework preset: **Vite** (detectado automaticamente). Build: `npm run build`,
   output: `dist`. O `vercel.json` já cuida do roteamento SPA.
4. Em *Environment Variables*, adicione as mesmas variáveis do `.env.local`:
   `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (chave pública).
5. Deploy. Não é necessário nenhum serviço pago nem ativar billing.

> No Supabase, em Authentication → URL Configuration, adicione a URL da Vercel
> em *Site URL* quando o deploy estiver no ar.

## Roadmap por etapas

| Etapa | Escopo | Status |
| ----- | ------ | ------ |
| 1 | Fundação, auth, Supabase, deploy | concluída |
| 2 · Plano 1 | Fundação do CRM: vitest, migration `0002`, types, services, kit UI, sidebar | concluída |
| 2 · Plano 2 | Leads / prospecção: lista, ficha, follow-ups, WhatsApp, CSV | concluída |
| 2 · Plano 3 | Oportunidades, pipeline Kanban, follow-ups, dashboard, configurações | implementado; validação RLS entre 2 usuários pendente |
| 3 · Plano 1 | Clientes, contratos, histórico e conversão de leads | implementado; migration e validação SQL pendentes de execução pelo usuário |
| 3 · Plano 2 | Projetos | planejado |
| 3 · Plano 3 | Financeiro | planejado |
| 3 · Finalização | Relatórios, configurações, backup, segurança e auditoria | planejada |