# Etapa 2 — Leads, Oportunidades, Pipeline e Prospecção (Design)

Data: 2026-11-22 · Status: aprovado em conversa, aguardando revisão final
Projeto: Ber CRM Free · Repo: carboniber-bit/Ber-CRM-Free

## 1. Escopo

Sobre a fundação da Etapa 1 (React 19 + TS + Vite 8 + Tailwind v4 + Supabase Free + React Router v7), implementar:

- Dashboard com dados reais e gráficos (Recharts)
- Módulo completo de Leads (CRUD, filtros, duplicidades, CSV)
- Central Inteligente de Oportunidades (derivada dos leads, sem cópias)
- Pontuação automática 0–100 com justificativas
- Pipeline Kanban com arrastar e soltar
- Histórico de contatos (timeline) e Follow-ups
- Prospecção: WhatsApp manual (wa.me), checklist de verificação digital
- Configurações funcionais (preços de serviços, template WhatsApp, perfil)
- Clientes, Projetos, Financeiro, Relatórios: navegação + páginas estruturadas com estado vazio "próxima etapa" (implementação futura)

Fora do escopo: conversão lead→cliente (Etapa 3), módulos financeiros, scraping, APIs pagas, automação de envio de mensagens.

## 2. Identidade visual (decisão do usuário 2026-11-22)

- Verde como cor principal de destaque; azul #6DB5FF, lime #FEFA3D e pink #FF5DE7 mantidos como acentos secundários.
- Montserrat (títulos) + Roboto (textos), empacotadas via @fontsource (sem requisição externa). Outfit removido.
- Dark mode: fundo #0D0D0D, cards #161616/#1E1E1E, bordas #2A2A2A, sombras suaves, transições leves.
- Lucide Icons. Interface pt-BR.
- Responsivo: sidebar vira drawer no mobile; tabelas viram cards; Kanban adapta navegação por coluna.

## 3. Banco de dados — migration `0002_etapa2.sql`

Não alterar `profiles`. Todas as tabelas novas: UUID PK (`gen_random_uuid()`), `owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade`, `created_at`/`updated_at` com trigger `set_updated_at`. RLS habilitado + políticas `owner_id = auth.uid()` para select/insert/update/delete + **GRANTs explícitos a `authenticated`** (projetos Supabase novos não concedem grants automáticos). Sem grants a `anon`.

### 3.1 `leads`

Informações básicas: `name text not null`, `responsible_name text`, `niche text` (valores sugeridos: barbearia, manicure, nail_designer, salao_beleza, restaurante, pizzaria, hamburgueria, lanchonete, cafeteria, clinica_estetica, comercio, outros — texto livre com sugestões), `phone text`, `whatsapp text`, `email text`, `cnpj text`, `instagram text`, `facebook text`, `website text`, `menu_url text`, `catalog_url text`.

Localização: `country text default 'Brasil'`, `state text`, `city text`, `district text`, `address text`, `zip_code text`.

Presença digital — 7 campos tri-estado `text not null default 'unverified' check in ('yes','no','unverified')`: `has_website`, `has_instagram`, `has_facebook`, `has_digital_menu`, `has_digital_catalog`, `has_landing_page`, `has_business_whatsapp`. Campo vazio/desconhecido = `unverified`, nunca ausência confirmada. Os campos de link (instagram, website, menu_url…) são complementares e não substituem o tri-estado.

Comercial: `status text not null default 'novo'` com check nos 11 valores: `novo, contato_realizado, aguardando_resposta, pediu_informacoes, interessado, negociando, aceitou, ignorou, nao_interessado, follow_up, perdido`. `offered_service text`, `notes text`, `source text` (origem do lead), `next_contact_at timestamptz`, `last_verified_at timestamptz`.

Valores (numeric(12,2) default 0, sempre separados): `estimated_value`, `negotiated_value`, `contracted_value`, `received_value`. Estimado nunca é tratado como faturamento/recebido.

Oportunidade (calculado pela aplicação a cada insert/update): `score int not null default 0 check 0..100`, `priority text not null default 'baixa' check in ('muito_alta','alta','media','baixa')`, `needs text[] not null default '{}'` (valores: `site, cardapio, landing, catalogo, presenca`), `score_reasons jsonb not null default '[]'` (lista de strings justificando cada ponto, só com dados cadastrados).

Índices: `(owner_id)`, `(owner_id, status)`, `(owner_id, niche)`, `(owner_id, city)`, `(owner_id, score desc)`, `(owner_id, created_at desc)`, `(owner_id, next_contact_at)`. Busca por nome: `ilike '%termo%'` (volume compatível com plano free; sem pg_trgm nesta etapa).

### 3.2 `lead_activities`

`lead_id uuid references leads on delete cascade`, `type text not null check in ('primeiro_contato','mensagem','ligacao','resposta','reuniao','proposta','mudanca_status','observacao','follow_up','outro')`, `description text not null`, `created_at timestamptz default now()`, `user_id uuid default auth.uid()`. Índice `(lead_id, created_at desc)`. Mudança de status (manual ou Kanban) gera atividade `mudanca_status` automática com de→para. Nenhum contato é inventado: registros só por ação do usuário.

### 3.3 `lead_followups`

`lead_id uuid references leads on delete cascade`, `due_at timestamptz not null`, `reason text`, `note text`, `status text not null default 'pendente' check in ('pendente','concluido','cancelado')`, `completed_at timestamptz`, `result text`. Índice `(owner_id, status, due_at)`. Ao concluir, registrar resultado e gerar atividade `follow_up` no lead. `leads.next_contact_at` reflete o follow-up pendente mais próximo (mantido pelo serviço).

### 3.4 `lead_digital_checks`

Checklist manual, 1 linha por item: `lead_id uuid references leads on delete cascade`, `item text not null check in ('instagram','website','digital_menu','whatsapp','digital_catalog','business_info')`, `verified boolean not null default false`, `verified_at timestamptz`, `unique (lead_id, item)`. Upsert individual; ao verificar qualquer item, atualizar `leads.last_verified_at`. Sem scraping nem enriquecimento pago.

### 3.5 `user_settings`

`owner_id uuid unique references auth.users on delete cascade`, `service_prices jsonb not null default '{"site":0,"landing":0,"cardapio":0,"catalogo":0,"outros":0}'`, `whatsapp_template text not null default ''`. Linha criada sob demanda (upsert) ao salvar configurações.

## 4. Pontuação de oportunidades — `src/lib/opportunity.ts` (função pura)

Entrada: campos do lead. Saída: `{ score, priority, needs[], reasons[] }`. Recalculada em todo insert/update no `leadService`. Abordagem aprovada: lógica em TS + colunas gravadas (filtros/ordenação/gráficos no servidor).

Regras (somente ausências **confirmadas** = `'no'`; `'unverified'` nunca pontua; teto 100):

| Critério | Pontos | Necessidade |
|---|---|---|
| `has_website = 'no'` | +25 | site |
| `has_digital_menu = 'no'` e nicho aplicável | +25 | cardapio |
| `has_instagram = 'yes'` e `has_website = 'no'` | +15 | landing |
| `has_digital_catalog = 'no'` e nicho aplicável | +10 | catalogo |
| Somente WhatsApp: `has_business_whatsapp='yes'` e website/instagram/facebook todos `'no'` | +10 | presenca |
| Infos comerciais incompletas: telefone, whatsapp e e-mail todos vazios | +5 | presenca |
| Presença limitada: ≥3 itens de presença confirmados `'no'` (só se "somente WhatsApp" não aplicado, para evitar dupla contagem) | +10 | presenca |

Nicho aplicável a cardápio: restaurante, pizzaria, hamburgueria, lanchonete, cafeteria. Aplicável a catálogo: os mesmos + comercio + outros.

Prioridade: 80–100 muito_alta · 60–79 alta · 40–59 media · 0–39 baixa.

`reasons[]`: uma frase por critério aplicado, citando apenas dados cadastrados (ex.: "Não possui site (confirmado)"). Se nenhum critério: score 0, reasons vazio, mensagem "Sem oportunidades confirmadas — verifique a presença digital". A pontuação é estimativa comercial, não garantia.

## 5. Oportunidades (página derivada, sem registros próprios)

Consulta sobre `leads` com `needs <> '{}'` e status fora de (`aceitou`, `perdido`, `nao_interessado`).

Filtros combináveis: nicho; necessidade (site, cardapio, landing, catalogo, presenca, "Instagram sem site" = instagram yes + website no, "Sem site e sem cardápio" = ambos no); prioridade; situação; cidade; bairro; data de cadastro (intervalo); faixa de pontuação.

Mapeamento situação→status:
- Não prospectado → `novo`
- Pronto para contato → `novo` ou `follow_up` com score ≥ 40
- Contato realizado → `contato_realizado`, `aguardando_resposta`, `pediu_informacoes`
- Interessado → `interessado` · Negociando → `negociando` · Convertido → `aceitou`
- Não interessado → `nao_interessado`, `ignorou`, `perdido`

Cards: nome, nicho, cidade/bairro, Instagram, telefone, site, barra de score, prioridade, necessidades, status. Ações: ver detalhes (ficha do lead), abrir Instagram, abrir WhatsApp, iniciar prospecção (abre a ficha existente com painel de contato — nunca cria lead).

Ficha da oportunidade = ficha do lead (`/leads/:id`), com seção "Por que esta empresa é uma oportunidade?" renderizando `score_reasons`.

Valor potencial: total = soma de `estimated_value` das oportunidades filtradas; preços padrão por serviço vindos de `user_settings` sugerem o valor estimado no formulário. Exibir sempre separados: estimado / negociado / contratado / recebido.

"Prospectar hoje": leads elegíveis = status fora de (aceitou, perdido, nao_interessado), ordenados por prioridade (muito_alta→alta), follow-up atrasado, score desc, não contatados primeiro. Botão "Próxima oportunidade" abre o primeiro elegível.

## 6. Leads (página `/leads`)

- Tabela no desktop / cards no mobile. Busca por nome; filtros: nicho, cidade, bairro, status, presença digital (por item tri-estado), data de cadastro; ordenação: data (asc/desc) e score (asc/desc). Paginação simples (limit/offset, 20/página).
- Formulário em seções (básico, localização, presença digital, comercial), validação: nome obrigatório; e-mail/URLs/CNPJ/telefone validados quando preenchidos; tri-estado explícito com padrão "Não verificado".
- Duplicidades: antes de salvar, consultar por telefone, whatsapp, cnpj (normalizados, só dígitos) ou nome+city (ilike). Se houver candidato: aviso com link "ver registro existente"; usuário pode prosseguir (nomes parecidos não bloqueiam).
- Excluir com modal de confirmação (cascade em atividades/followups/checks).
- CSV (papaparse): export da view filtrada atual; import com preview tabular, validação linha a linha (nome obrigatório, tri-estado aceita sim/não/não verificado, datas ISO/BR), flag de duplicidade pelos mesmos critérios, duplicados ignorados por padrão (opção de incluir), relatório final: importados / ignorados / erros com motivo.
- Feedback: toasts de sucesso/erro, skeleton de carregamento, estado vazio com orientação "Cadastre seu primeiro lead".

## 7. Ficha do lead (`/leads/:id`)

Seções: dados completos (editar), presença digital + checklist de verificação (atualização individual com data), oportunidade (barra de score, prioridade, necessidades, justificativas), valores (4 campos separados), timeline de atividades (adicionar observação/contato manual), follow-ups (agendar, concluir com resultado), ações: abrir WhatsApp, registrar contato, agendar follow-up, mudar status (select com confirmação → grava atividade).

## 8. Prospecção e WhatsApp — `src/lib/whatsapp.ts`

- Normalização: remover não-dígitos; se 10–11 dígitos (DDD+número), prefixar `55`; validar 12–13 dígitos resultantes; inválido → erro pt-BR, sem link.
- Link `https://wa.me/55DDDNUMERO?text=<mensagem codificada>`; mensagem inicial editável (template de `user_settings`), aberta em nova aba. **Nunca envia automaticamente; sem API paga.**
- "Iniciar prospecção" abre a ficha do lead existente; status só muda após confirmação explícita; toda ação registra data no histórico.

## 9. Pipeline (`/pipeline`)

Kanban @dnd-kit (core + sortable), 11 colunas = 11 status. Cards compactos: nome, nicho, telefone, prioridade, valor estimado, próximo follow-up. Drag & drop → update de status no Supabase + atividade `mudanca_status` + dashboard reflete (revalidação de queries). Filtros: nicho, cidade, prioridade. Mobile: seletor de coluna (uma coluna por vez) + mover via menu de ações do card (alternativa ao arraste). Scroll horizontal com colunas de largura fixa no desktop.

## 10. Follow-ups (`/followups`)

Listas: hoje (pendentes, due hoje), futuros (due > hoje), atrasados (due < agora, pendentes — destaque visual danger), concluídos. Marcar concluído → pedir resultado (opcional), gravar `completed_at`/`result` + atividade no lead. Cadastro de follow-up a partir da ficha do lead e da página de follow-ups (selecionando lead). Seção "Oportunidades para prospectar hoje" conforme §5.

## 11. Dashboard (`/`)

Indicadores (queries reais, sem números fictícios):
- Total de leads; novos (`novo`); contatados (`contato_realizado`,`aguardando_resposta`,`pediu_informacoes`); interessados (`interessado`); em negociação (`negociando`); convertidos (`aceitou`)
- Total de oportunidades (needs não vazio, status elegível §5); alta prioridade (alta+muito_alta entre elas)
- Follow-ups pendentes; atrasados

Gráficos Recharts: leads por período (created_at, agrupado por mês), leads por nicho (barras), leads por status (barras), oportunidades por prioridade (barras), conversão (funil em barras: novo→contatado→interessado→negociando→aceitou).

Atividades recentes: últimos leads cadastrados, últimas atividades, últimas mudanças de status, próximos follow-ups, atrasados. Ações rápidas: Novo lead, Ver oportunidades, Abrir pipeline, Ver follow-ups. Sem dados → estados vazios orientando o primeiro cadastro.

## 12. Configurações (`/configuracoes`)

Funcional: nome do perfil (tabela profiles existente), preços padrão por serviço (site, landing, cardápio, catálogo, outros), mensagem inicial do WhatsApp (textarea com preview). Placeholder: Clientes, Projetos, Financeiro, Relatórios (estrutura visual + estado vazio "Disponível na próxima etapa").

Sidebar: Dashboard, Leads, Oportunidades, Pipeline, Clientes, Projetos, Financeiro, Relatórios, Configurações. Follow-ups acessível pelo dashboard (ação rápida), topbar (ícone com contador de atrasados) e ficha do lead.

## 13. Bibliotecas novas (todas gratuitas/MIT)

`recharts`, `@dnd-kit/core`, `@dnd-kit/sortable`, `papaparse`, `@fontsource-variable/montserrat`, `@fontsource/roboto`. Remover `@fontsource-variable/outfit`. Nada pago, sem trials, sem billing.

## 14. Arquitetura frontend (preservando a existente)

- `services/`: leadService, activityService, followupService, digitalCheckService, settingsService (supabase client existente; erros traduzidos pt-BR).
- `lib/`: opportunity.ts (pura, testável), whatsapp.ts, csv.ts, format.ts (moeda BRL, datas, telefone).
- `types/`: lead.ts, activity.ts, followup.ts, settings.ts + enums de status/nicho/presença.
- `components/`: leads/, opportunities/, pipeline/, dashboard/, followups/, ui/ (Toast provider próprio, Modal de confirmação, Skeleton, EmptyState, ScoreBar, PriorityBadge, PresenceBadge, FilterBar).
- `pages/`: LeadsPage, LeadDetailPage, OpportunitiesPage, PipelinePage, FollowUpsPage, SettingsPage, DashboardPage (reescrita), placeholders.
- Dados compartilhados: um único registro de lead em todos os módulos; alterações revalidam queries afetadas (sem cache global complexo — refetch por invalidate simples via contexto/hooks).
- Estados obrigatórios em todas as páginas: loading, vazio, sucesso, erro, confirmação destrutiva, validação, feedback pós-save, erro de conexão. Nenhum botão decorativo.

## 15. Segurança e custos

- Somente chave publishable no frontend (.env.local); service role nunca.
- RLS owner_id = auth.uid() em todas as tabelas novas + grants explícitos.
- Sem credenciais no código; .env.example permanece template.
- Supabase Free / Vercel Hobby / GitHub Free; volume esperado dentro dos limites; sem APIs pagas, sem scraping, sem automação de mensagens.

## 16. Testes obrigatórios (seção 18 da spec do usuário)

Build + typecheck + lint; teste manual no navegador com login real: CRUD de leads, validação, busca/filtros combinados, CSV import/export, duplicidades, pontuação e reclassificação, cards/detalhes de oportunidades, iniciar prospecção, WhatsApp (validação de número + link), Kanban drag & drop + atualização de status + histórico, follow-ups (listas, concluir, atrasados), indicadores e gráficos do dashboard, persistência Supabase, RLS (usuário não vê dados de outro), responsividade (desktop + viewport mobile). Corrigir erros antes de concluir. Não afirmar teste não executado. Relatório final conforme seção 20 da spec.

Dependência: usuário fornece e-mail/senha de teste (usuário já criado no dashboard).

## 17. Ordem de implementação

1. Migration 0002 (usuário executa no SQL Editor) + tipos
2. Identidade visual (fontes, tokens, layout/sidebar) + UI base (toast, modal, skeleton, empty)
3. leadService + opportunity.ts + CRUD Leads + ficha
4. Oportunidades (filtros, cards, prospectar hoje)
5. Pipeline Kanban
6. Atividades + Follow-ups + checklist
7. Dashboard real + gráficos
8. CSV import/export
9. Configurações + placeholders
10. Testes completos + correções + relatório

Etapa 3 não inicia sem autorização explícita.