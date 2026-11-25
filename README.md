# Ber CRM — CRM de Prospecção Comercial

CRM profissional construído por etapas, 100% em planos gratuitos.

**Etapa atual: 1 — Fundação** (estrutura, autenticação, conexão Supabase e deploy).
Módulos de Leads, Projetos e Financeiro serão implementados nas próximas etapas.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- React Router v7
- Supabase Free (PostgreSQL + Auth)
- Lucide Icons · Fonte Outfit
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
   [`0004_followup_atomic.sql`](supabase/migrations/0004_followup_atomic.sql) e
   [`0005_followup_rpc_json.sql`](supabase/migrations/0005_followup_rpc_json.sql).
   As migrations criam as tabelas privadas, os índices, as políticas RLS e as
   RPCs e triggers transacionais de follow-up.
4. **Crie seu usuário**: Dashboard → Authentication → Users → *Add user* →
   informe e-mail e senha (marque *Auto Confirm User*). Não há cadastro público.
5. Acesse `/status` no app para validar tudo, depois faça login em `/login`.

### Segurança

- Apenas a chave **pública** (anon/publishable) é usada no frontend.
  **Nunca** coloque a `service_role` key no `.env.local` ou no código.
- RLS ativo nas tabelas privadas: cada usuário acessa somente os próprios dados.
- Rotas internas protegidas por sessão; sem sessão → redireciona para `/login`.
- `.env.local` está no `.gitignore` — credenciais nunca vão para o GitHub.

## Estrutura do projeto

```
src/
  components/   UI base (Button, Input, Card, StatusDot…) + AuthProvider + ErrorBoundary
  pages/        LoginPage, DashboardPage, StatusPage, NotFoundPage
  layouts/      AuthLayout (login) e AppLayout (app autenticado)
  hooks/        useAuth
  services/     authService (login/logout, tradução de erros)
  lib/          supabase.ts (cliente único, lê variáveis de ambiente)
  types/        Profile
  utils/        helpers
  routes/       AppRoutes + ProtectedRoute
supabase/
  migrations/   0001–0005 (profiles, leads, CRM, duplicidades e follow-ups atômicos)
```

Rotas: `/login` (pública) · `/status` (pública, diagnóstico) · `/` (protegida) · 404.

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
| 1 | Fundação, auth, Supabase, deploy | ✅ concluída |
| 2 | Leads / prospecção | aguardando autorização |
| 3 | Projetos | planejada |
| 4 | Financeiro | planejada |