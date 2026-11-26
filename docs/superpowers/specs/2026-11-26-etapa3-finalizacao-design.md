# Etapa 3 — Relatórios, Configurações, Backup, Segurança e Finalização (Design)

Data: 2026-11-26 · Status: autorizado pelo anexo do usuário em 2026-11-26
Projeto: Ber CRM Free · Repo: carboniber-bit/Ber-CRM-Free

## 1. Objetivo e precedência

Finalizar o Ber CRM existente como um sistema privado e integrado para prospecção, clientes, projetos, finanças, análises, configurações e proteção de dados, sem recriar o projeto ou trocar a stack.

O anexo de 2026-11-26 amplia a mesma Etapa 3 e supersede apenas a exclusão de relatórios avançados na spec de 2026-11-25. Os Planos 1–3 continuam sendo a fundação: Clientes, Projetos e Financeiro. Não será criada uma Etapa 4 para os módulos deste documento.

## 2. Escopo

### Dentro do escopo

- Página Relatórios com visões de Prospecção, Oportunidades, Clientes, Projetos, Financeiro e Consolidado.
- Filtros de período, nicho, cidade, status e serviço quando aplicável.
- Indicadores, gráficos Recharts e análises com dados reais do Supabase.
- Exportações CSV filtradas por módulo e consolidadas.
- Configurações de perfil, empresa, comercial, prospecção, projetos, financeiro e interface.
- Backup manual completo, manifesto de integridade, prévia e restore transacional confirmado.
- Diagnóstico read-only de integridade.
- Auditoria de autenticação, RLS, credenciais, validação, XSS, consultas e atividades.
- Trilha de auditoria append-only para eventos importantes.
- Testes técnicos, funcionais e visuais; responsividade; performance; CI.
- README, documento do banco, instruções Vercel Hobby e relatório final classificado.

### Fora do escopo

- Recriar o sistema, trocar framework/banco/biblioteca de gráficos ou remover funcionalidades.
- Service Role Key no frontend, novo backend, Edge Functions ou automação paga.
- WhatsApp API, scraping abusivo, enriquecimento pago, APIs pagas, trials ou upgrades.
- Emissão de notas, boletos, cobrança automática ou integração bancária.
- Backfill automático de leads `aceitou` para clientes.
- Conversão automática ao arrastar lead para `aceitou`.
- Números fictícios, conclusões sem amostra suficiente ou testes alegados sem execução.
- Push, deploy, SQL remoto ou publicação externa sem autorização específica.
- Operações destrutivas sem backup e confirmação.

## 3. Restrições permanentes

- Stack: React, TypeScript, Vite, Tailwind CSS v4, React Router, Supabase Free, Recharts, DnD Kit, Lucide e bibliotecas open source gratuitas.
- Interface pt-BR, dark mode grafite, verde primário, Montserrat/Roboto e acentos azul/lime/rosa.
- Credenciais reais somente em `.env.local`; `.env.example` sem segredos.
- RLS em todas as tabelas privadas; cada usuário acessa somente seus registros.
- Dinheiro em centavos inteiros no TypeScript e `numeric(14,2)` no PostgreSQL.
- Estimado, negociado, contratado, recebido e pendente permanecem separados.
- Receita realizada vem somente de `financial_payments` menos estornos; `leads.received_value` não alimenta caixa ou lucro.
- Datas de agrupamento em `America/Sao_Paulo`; início inclusivo e fim exclusivo.
- Campo vazio/desconhecido não é ausência confirmada; denominador zero produz `null`.
- Registros financeiros dependentes são cancelados/estornados, não apagados.
- Alterações importantes são auditadas sem senhas, tokens ou dados excessivos.
- Nenhuma funcionalidade é considerada testada sem evidência real.

## 4. Arquitetura

### 4.1 Frontend

- `src/pages/ReportsPage.tsx`: página central com seis visões.
- `src/components/reports/`: filtros, indicadores, gráficos, tabelas, exportação e estados.
- `src/services/reportService.ts`: RPCs de agregação e exportação cursorizada.
- `src/lib/reports.ts`: períodos, filtros e normalizações puras.
- `src/pages/SettingsPage.tsx`: seções comerciais, prospecção, projetos, financeiro, interface e perfil.
- `src/pages/BackupPage.tsx`: exportação, diagnóstico, importação e limites.
- Relatórios e Backup carregados sob demanda; Recharts é isolado em chunks sob demanda tanto no Dashboard quanto nos Relatórios.
- Supabase direto e RPCs; sem nova biblioteca global de estado.

### 4.2 Banco

- RPCs de leitura `security invoker`, `search_path = ''`, objetos qualificados e grants explícitos.
- RLS das tabelas subjacentes é a autoridade; views usam `security_invoker = true`.
- Agregações no servidor; exportações detalhadas paginadas por cursor.
- Restore amplo é `security definer`, valida dono/relações/duplicidades e executa em transação única.
- Migrations aditivas após `0009`, sem editar histórico.

### 4.3 Migrations

- `0010_etapa3_reports.sql`: RPCs de relatório/exportação, views e índices.
- `0011_etapa3_settings.sql`: preferências versionadas, categorias de receita e categoria de tarefa.
- `0012_etapa3_backup.sql`: manifesto e RPC transacional de restore.
- `0013_etapa3_security_audit.sql`: endurecimento, auditoria append-only e diagnóstico.

## 5. Contrato de filtros

```ts
type ReportPeriod =
  | 'today' | 'last_7_days' | 'last_30_days' | 'this_month' | 'previous_month'
  | 'last_3_months' | 'last_6_months' | 'this_year' | 'previous_year' | 'custom'

interface ReportFilters {
  period: ReportPeriod
  startDate?: string
  endDate?: string
  niche?: string
  city?: string
  status?: string
  service?: string
}
```

- `startDate` e `endDate` são datas locais inclusivas; o servidor recebe `[início do startDate, início do dia seguinte a endDate)` em UTC, normalizado a partir de `America/Sao_Paulo`.
- Controles inaplicáveis ficam desabilitados e explicados.
- Nichos/status usam códigos canônicos; rótulos personalizados são apresentação.
- Serviço compara `offered_service`, `projects.service` ou `contracts.service`.
- A mesma alteração de filtro atualiza indicadores, gráficos, tabelas e exportações.
- Resposta inclui `generated_at`, período, filtros e avisos de amostra insuficiente.

## 6. Relatórios

### 6.1 Prospecção

- Coorte de cadastro: `leads.created_at` no período. Novos, interessados, negociando, perdidos e não interessados usam o status atual dessa coorte, explicitamente rotulado como snapshot.
- Contatados e responderam são eventos de todos os leads no período: lead com atividade `primeiro_contato`, `mensagem` ou `ligacao`, e lead com atividade `resposta`, respectivamente.
- Convertidos por período usam `lead_client_links.converted_at`; nunca status `aceitou` isolado.
- Total de contatos: quantidade de atividades `primeiro_contato`, `mensagem` ou `ligacao` no período.
- Taxa de resposta: leads distintos com resposta no período / leads distintos com contato no período; `null` sem contatos.
- Taxa de conversão: leads da coorte com vínculo convertido dentro do período / total da coorte; `null` sem leads.
- Gráficos: cadastros por período, nicho, cidade, status, conversões e evolução da conversão.
- Ranking requer 3 registros; taxa requer denominador 5. Abaixo disso: contagem e “Dados insuficientes para conclusão”.

### 6.2 Oportunidades

- Oportunidade é o próprio lead qualificado; não há cópia.
- Prioridades, necessidades, nichos e conversão usam dados reais.
- Ausência confirmada de site/cardápio usa `no`; `unverified` é separado.
- Instagram sem site exige Instagram `yes` e site diferente de `yes`, separando `no` de `unverified`.
- Não prospectadas: status `novo` sem contato registrado.
- Potencial estimado e negociado são somas separadas.
- Contratado do lead é snapshot comercial; recebido só pode vir do ledger financeiro.
- Gráficos: nicho, necessidade, prioridade, conversão, potencial por serviço e distribuição por cidade/estado.

### 6.3 Clientes

- Total, ativos, inativos, em projeto, com pagamento pendente e novos clientes.
- Em projeto deriva de projetos não cancelados e não concluídos/entregues.
- Pendências vêm do Financeiro canônico.
- Novos clientes usam `created_at`; conversões usam `converted_at`.
- Nicho de cliente convertido vem do lead vinculado; manual sem nicho é “Não informado”.
- Histórico combina atividades do cliente, contratos e timelines vinculadas sem duplicar eventos.

### 6.4 Projetos

- Contagens por status canônico.
- Atrasado: prazo vencido e status não concluído/entregue/cancelado.
- Prazo médio: `completed_at - start_date` com ambas as datas; `null` sem amostra.
- Taxa de conclusão: projetos da coorte criada no período que estão concluídos/entregues / projetos da coorte não cancelados; `null` sem denominador.
- Produtividade: conclusões/entregas por `completed_at` no período.
- Atenção: atrasados, revisão/aprovação pendente ou tarefas vencidas.

### 6.5 Financeiro

- Contratado ativo: contratos não cancelados.
- Recebido líquido: recebimentos menos estornos por data efetiva.
- Pendente: saldo ativo, nunca negativo.
- Despesas pagas/pendentes separadas; canceladas fora dos totais.
- Lucro realizado: recebido líquido do período menos despesas pagas do período.
- Saldo acumulado inclui movimentos anteriores ao início.
- Atrasados vêm de parcelas ou vencimento geral quando não há parcelas.
- Contratado versus recebido não é lucro; estimado não é receita.
- Gráficos: recebimentos, despesas, lucro, contratado versus recebido, categorias, formas de pagamento e saldo.

### 6.6 Consolidado

- Totais exatos de leads, clientes, projetos e movimentos.
- Cruzamentos por nicho/cidade/serviço somente com chave relacional válida.
- CSV consolidado por bucket período/nicho/cidade/serviço com contagens e valores rotulados.
- Exports detalhados permanecem disponíveis por módulo.

## 7. Exportações CSV

- UTF-8 com BOM, separador `;`, cabeçalhos pt-BR.
- Datas `DD/MM/AAAA`; timestamps `DD/MM/AAAA HH:mm`.
- Dinheiro em padrão brasileiro com duas casas.
- Proteção contra fórmulas mantida.
- IDs e relacionamentos preservados no backup.
- Nenhum segredo ou dado de outro proprietário.
- Leads, oportunidades, clientes, projetos, receitas/pagamentos, despesas e consolidado.
- Filtros aplicáveis respeitados.
- Cursor estável e páginas de até 1.000 registros.
- Limite de segurança aborta a operação sem entregar parcial como completo.

## 8. Configurações

`user_settings` é preservado. `0011` acrescenta `preferences jsonb` versionado sem remover `service_prices` ou `whatsapp_template`.

```ts
interface UserPreferences {
  version: 1
  company: {
    name: string
    niches: string[]
    services: Array<{ code: string; label: string; defaultDays: number; referenceValueCents: number | null }>
    paymentMethods: string[]
    commercialNotes: string
  }
  commercial: {
    statusLabels: Record<string, string>
    statusOrder: string[]
    defaultStatus: string
    followupIntervalsDays: number[]
    scoringThresholds: { veryHigh: number; high: number; medium: number }
  }
  opportunities: {
    needLabels: Record<string, string>
  }
  projects: {
    statusLabels: Record<string, string>
    taskCategories: string[]
    checklistTemplates: Array<{ name: string; items: string[] }>
    priorities: string[]
  }
  finance: {
    paymentMethods: string[]
    display: 'compact' | 'comfortable'
  }
  ui: {
    density: 'compact' | 'comfortable'
    itemsPerPage: number
    defaultLeadSort: string
  }
}
```

- Status são personalizáveis em rótulo, ordem e padrão; códigos/constraints não mudam.
- Novos códigos de status não são criados nesta etapa.
- Categorias de oportunidades personalizam rótulos de necessidades canônicas e critérios de pontuação.
- Registros existentes não são recalculados automaticamente; recalcular exige prévia e confirmação.
- Nichos atendidos usam a lista canônica.
- `service_prices` continua fonte dos valores de referência fixos já usados nos formulários.
- Categorias de despesas usam o Plano 3; categorias de receita ganham tabela e vínculo opcional em pagamentos.
- Tarefas ganham categoria textual opcional; checklist templates são sugestões.
- Dark mode é o tema real e padrão; densidade, itens por página e ordenação são configuráveis.
- Nome usa `profiles`; e-mail/senha usam Supabase Auth com confirmação/reauth.
- Validação no cliente e novamente no banco para dados críticos/restore.

## 9. Backup e dados

### 9.1 Exportação

- ZIP local com `manifest.json` e CSVs de leads, atividades, follow-ups, verificações, clientes, vínculos, contratos, projetos, tarefas, revisões, parcelas, pagamentos, alocações, estornos, despesas, categorias e preferências.
- `fflate` open source empacota/desempacota no navegador; nenhum upload para terceiros.
- Manifesto: versão, data, contagens, arquivos e hashes.
- Limites de tamanho, arquivos e linhas validados antes do download.
- UI informa que backup manual não substitui backup do banco e que free tiers têm limites.

### 9.2 Restore

- Somente pacote do sistema ou estrutura manifestada compatível.
- Prévia valida schema, hashes, dono, datas, valores, status, duplicidades e relações.
- Resumo classifica novos, idênticos e conflitos.
- Padrão sem sobrescrever; idênticos ignorados; conflitos abortam.
- Grava somente no proprietário autenticado; `owner_id` do arquivo não autoriza nada.
- IDs preservados apenas sem colisão; relações validadas antes da escrita.
- RPC executa o pacote inteiro ou nada.
- Limites explícitos de payload/linhas; excedentes rejeitados antes da escrita.
- Confirmação explícita após o resumo.
- Nenhuma senha, token ou credencial no pacote.
- Restore financeiro usa RPC dedicada e auditoria; não concede INSERT direto.

### 9.3 Diagnóstico

- Read-only: órfãos, duplicidades, valores/datas/status inválidos, saldos/alocações divergentes e vínculos de dono incompatíveis.
- Nenhuma correção ou exclusão automática.
- Correção destrutiva exige backup, confirmação e procedimento separado.

## 10. Segurança e auditoria

### 10.1 Autenticação

- Login, logout, recuperação, persistência e expiração testados.
- Rota privada sem sessão → `/login`; Supabase não configurado → `/status`.
- Recuperação usa `resetPasswordForEmail` e URL de retorno configurada no Supabase.
- E-mail/senha somente via Supabase Auth; nenhuma credencial no CRM.

### 10.2 Banco

- Auditar RLS/grants de todas as tabelas privadas.
- Revogar UPDATE/DELETE direto em trilhas e tabelas financeiras desnecessárias.
- Impedir autoedição de `profiles.role`.
- Corrigir `search_path` de `handle_new_user` e funções sensíveis.
- Checks monetários, datas, status e FKs compostas com `owner_id` verificados e corrigidos também nas tabelas legadas.
- Teste com dois proprietários sintéticos preparado para execução manual autenticada; sem evidência real, fica dependente de configuração externa.

### 10.3 Auditoria append-only

- Tabela `audit_events` própria: `owner_id`, `actor_id`, `action`, `entity_type`, `entity_id`, metadados mínimos e `created_at`.
- `audit_events` concede somente SELECT ao proprietário; INSERT/UPDATE/DELETE direto revogados e escrita por triggers/RPCs `security definer` com `search_path = ''`.
- `lead_activities` e `client_activities` seguem como histórico de negócio; UPDATE/DELETE de eventos importantes são revogados.
- Eventos de lead, cliente, projeto, pagamento, estorno, despesa, cancelamento, restore e settings gravados por triggers/RPCs.
- Usuário, tipo, IDs, data e metadados mínimos allowlisted.
- Sem senhas, tokens, chaves ou payloads brutos.
- Falha de auditoria obrigatória reverte a operação principal.

### 10.4 Frontend

- Validação de fronteira, escape React, URLs seguras e proteção CSV.
- Nenhum HTML não confiável renderizado.
- RLS é autoridade final; erros sem detalhes internos.

## 11. Performance

- Agregações no servidor.
- Cursor/ordenação estável em exports e listagens extensas.
- Índices por dono, data, status, nicho, cidade, serviço, vencimento e FKs frequentes.
- Lazy loading de Relatórios, Backup e Recharts.
- Sem waterfall de consultas independentes, request sem paginação ou regressão funcional.
- Métricas de velocidade só declaradas quando medidas.

## 12. Testes, CI e Vercel

- TDD RED/GREEN para períodos, filtros, taxas, dinheiro, CSV, settings, backup e RPC contracts.
- Integração de páginas com serviços mockados e componentes reais.
- Smoke browser local mockado para jornadas e responsividade.
- Gate final: `npm test -- --maxWorkers=2`, `npm run build`, `npm run lint`.
- `README.md` e `docs/supabase-schema.md` documentam instalação, migrações, RLS, tabelas, relacionamentos, testes, manutenção e limitações free tier.
- GitHub Actions Node 24 em `.github/workflows/ci.yml` com `npm ci`, testes, lint e build; sem segredos no gate público.
- Vercel Hobby: rewrite SPA, headers, variáveis públicas e instruções em `docs/vercel-deploy.md`.
- Nenhum deploy sem autorização.
- Migrations, RLS real entre dois usuários, persistência autenticada e publicação ficam “dependentes de configuração externa” quando não executados.

## 13. Sequência e dependências

1. WP0 — concluir Plano 1: Pipeline, KPI global, rotas e revisão.
2. WP1 — corrigir auditoria do Plano 2 e executar Projetos.
3. WP2 — executar Financeiro do Plano 3.
4. WP3 — Relatórios e exports (`0010`).
5. WP4 — Configurações, Backup/Dados e restore (`0011`–`0012`).
6. WP5 — Segurança, auditoria, integridade, RLS runtime e performance (`0013`).
7. WP6 — jornada integrada, responsividade, CI, documentação, preparação Vercel e relatório final.

## 14. Critérios de aceite

- Cada módulo tem rota, testes e estados loading/vazio/erro.
- Relatórios usam dados reais, filtros consistentes e cálculos canônicos.
- CSV respeita RLS/filtros e não vaza segredos.
- Backup tem manifesto, prévia, confirmação e restore transacional ou pendência classificada.
- Settings não altera registros antigos silenciosamente.
- Nenhum Critical/Important de segurança, persistência ou integridade financeira aberto.
- Build, lint e suíte completa passam com evidência fresca.
- README e documento do banco atualizados sem credenciais.
- Relatório final classifica cada funcionalidade como concluída/testada, implementada/não testada, pendente ou dependente de configuração externa.
- O CRM só é declarado finalizado sem bloqueios críticos; caso contrário, a conclusão é parcial e explícita.
