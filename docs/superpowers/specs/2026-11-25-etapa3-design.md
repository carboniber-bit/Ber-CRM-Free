# Etapa 3 — Clientes, Projetos, Produção e Financeiro (Design)

Data: 2026-11-25 · Status: aprovado em conversa, aguardando revisão do documento
Projeto: Ber CRM Free · Repo: carboniber-bit/Ber-CRM-Free

## 1. Objetivo

Ampliar o Ber CRM existente para acompanhar a jornada completa lead → cliente → contrato → projeto → tarefas/revisões/entrega → recebimentos/despesas/lucro, sem recriar o projeto, sem trocar a stack e sem exigir novos serviços pagos.

A Etapa 3 reúne três módulos integrados:

1. Clientes e conversão idempotente de leads.
2. Projetos, produção, tarefas, revisões e entregas.
3. Contratos, parcelas, recebimentos, despesas, fluxo de caixa e lucro realizado.

## 2. Escopo

### Dentro do escopo

- CRUD de clientes, com busca, filtros, detalhe e históricos.
- Conversão explícita de lead em cliente na ficha do lead e no Pipeline.
- RPC transacional de conversão, com proteção contra duplicidade.
- Contratos como fonte da receita contratada.
- Projetos com cards, lista e Kanban.
- Tarefas, progresso automático, revisões, aprovações e entrega.
- Histórico unificado do cliente e eventos importantes do projeto.
- Parcelas, pagamentos parciais, estornos e validação de saldo.
- Despesas, categorias personalizadas, baixa e cancelamento.
- Dashboard financeiro, fluxo de caixa e gráficos Recharts com dados reais.
- RLS por proprietário em todas as tabelas privadas.
- Testes automatizados e validação autenticada dos fluxos implementados.

### Fora do escopo

- Recriar o sistema, trocar framework, banco, biblioteca de gráficos ou padrão visual.
- Backfill automático de leads `aceitou` para clientes.
- Conversão automática ao arrastar um lead para `aceitou`.
- Envio automático de mensagens, WhatsApp API, scraping ou enriquecimento pago.
- Service Role Key no frontend, Edge Functions, novos backends ou automações pagas.
- Emissão de notas, boletos, cobrança automática ou integração bancária.
- Relatórios avançados que não façam parte dos três módulos desta etapa.
- Afirmar que RLS entre dois usuários foi validado antes da execução real desse teste.

## 3. Restrições e decisões permanentes

- Stack mantida: React 19, TypeScript, Vite 8, Tailwind CSS v4, React Router 7, Supabase Free, Recharts, `@dnd-kit`, Lucide.
- Interface em pt-BR, dark mode grafite, verde principal, Montserrat/Roboto e acentos azul/lime/rosa.
- Somente ferramentas gratuitas e free tiers; nenhuma cobrança, trial ou upgrade.
- Credenciais reais somente em `.env.local`; `.env.example` permanece sem credenciais.
- Nenhuma tabela privada sem RLS; cada usuário acessa somente os próprios registros.
- Nenhuma mensagem automática ao cliente.
- Nenhum número fictício apresentado como dado real.
- Valores estimados, negociados, contratados, recebidos e pendentes permanecem semanticamente separados.
- Registros financeiros com dependências são cancelados/arquivados, não excluídos definitivamente.
- Alterações importantes são registradas no histórico.
- Nenhuma funcionalidade é considerada testada sem execução e evidência real.

## 4. Base existente e pontos de integração

A Etapa 2 permanece intacta. As integrações serão incrementais:

- A ação “Converter em cliente” será adicionada às ações de `src/pages/LeadDetailPage.tsx`, hoje na região das linhas 263–313.
- O Pipeline receberá a mesma ação explícita no card, propagada por `KanbanColumn`, sem alterar o significado do arraste para `aceitou`.
- O placeholder de Clientes será substituído pelas rotas `/clientes`, `/clientes/novo` e `/clientes/:id`.
- O placeholder de Projetos será substituído por `/projetos`, `/projetos/novo` e `/projetos/:id`.
- O placeholder de Financeiro será substituído por `/financeiro`.
- O README e o placeholder de Financeiro serão corrigidos para mostrar Clientes, Projetos e Financeiro na Etapa 3.
- O indicador “Convertidos” deixará de contar apenas `leads.status = 'aceitou'` e passará a contar vínculos reais em `lead_client_links`.
- Os componentes de UI existentes serão reutilizados: `Modal`, `ConfirmDialog`, `Card`, `Button`, `Input`, `Select`, `Textarea`, badges, toasts, skeletons e estados vazios.
- Os padrões de serviço, cancelamento de respostas obsoletas, refresh-error e filas de mutação do Pipeline serão preservados.

## 5. Modelo relacional

Todas as tabelas novas usam UUID, `owner_id`, timestamps e RLS. Valores monetários usam `numeric(14,2)`. No frontend, dinheiro é representado em centavos inteiros e convertido para decimal com duas casas apenas na fronteira com o Supabase.

### 5.1 `clients`

Cadastro da empresa e situação comercial.

Campos:

- `id uuid` PK.
- `owner_id uuid not null default auth.uid()`.
- `creation_key uuid unique`: chave de idempotência do cadastro; na conversão, usa o UUID do lead.
- Dados da empresa espelhados do lead quando houver conversão: nome, responsável, telefone, WhatsApp, e-mail, CNPJ, Instagram, site, endereço, cidade, bairro, CEP, estado e nicho.
- `cnpj_digits text` gerado a partir do CNPJ.
- `status text not null default 'active'`: `active`, `in_project`, `awaiting_payment`, `awaiting_approval`, `project_completed`, `inactive`.
- `converted_at timestamptz`; nulo em cadastro manual.
- `source text`; origem do lead ou `manual`.
- `notes text`.
- `archived_at timestamptz`.
- `created_at`, `updated_at`.

Regras:

- Status é editável manualmente.
- CNPJ preenchido é único por proprietário mediante índice único parcial em `(owner_id, cnpj_digits) WHERE cnpj_digits IS NOT NULL`.
- Telefone, nome + cidade e CNPJ vazio são usados como aviso de possível duplicidade; apenas CNPJ preenchido bloqueia duplicata.
- Cliente não é excluído quando possui contrato/projeto; usa `archived_at` ou status `inactive`.

### 5.2 `lead_client_links`

Vínculo entre prospecção e cliente.

- `id uuid` PK.
- `owner_id uuid`.
- `lead_id uuid not null`.
- `client_id uuid not null`.
- `converted_at timestamptz not null default now()`.
- `created_at`.

Restrições:

- `unique (lead_id)`: um lead gera no máximo um cliente.
- Um cliente pode receber vínculos de vários leads.
- FKs compostas `(owner_id, lead_id)` e `(owner_id, client_id)` garantem o mesmo proprietário.
- O vínculo é a verdade operacional para “lead convertido”.

### 5.3 `contracts`

Fonte única da receita contratada.

- `id uuid` PK.
- `owner_id uuid`.
- `client_id uuid not null`.
- `source_link_id uuid unique`: quando criado por conversão; nulo em contrato manual.
- `service text not null`.
- `total_value numeric(14,2) not null check (total_value >= 0)`.
- `contracted_at date not null`.
- `due_date date`: vencimento geral quando não houver parcelas.
- `payment_method text`.
- `payment_terms text`.
- `status text not null default 'active'`: `active`, `cancelled`.
- `notes text`.
- `cancelled_at timestamptz`.
- `created_at`, `updated_at`.

Regras:

- `unique (source_link_id)` quando não nulo: uma conversão gera no máximo um contrato.
- Todo contrato pertence a um cliente do mesmo proprietário.
- O status financeiro é derivado de parcelas/pagamentos; não é digitado manualmente.
- Contrato cancelado deixa de entrar em totais ativos, mas preserva histórico.
- Cadastro manual de cliente cria cliente e contrato inicial na mesma transação.
- Após a primeira parcela ou pagamento, o valor total só pode mudar pelo RPC `adjust_contract`, que valida o novo total contra o recebido líquido e reescreve as parcelas atomicamente.

### 5.4 `projects`

Execução do serviço contratado.

- `id uuid` PK.
- `owner_id uuid`.
- `client_id uuid not null`.
- `contract_id uuid not null`.
- `source_link_id uuid unique`: projeto criado pela conversão; nulo em projeto manual.
- `name text not null`.
- `service text not null`.
- `contracted_value numeric(14,2) not null check (contracted_value >= 0)`: parcela do valor do contrato alocada a este projeto.
- `description text`.
- `start_date date`.
- `due_date date`.
- `responsible_name text`.
- `priority text not null default 'media'`: `very_high`, `high`, `medium`, `low`.
- `status text not null default 'not_started'`: `not_started`, `planning`, `in_development`, `awaiting_client_info`, `in_review`, `awaiting_approval`, `changes_requested`, `completed`, `delivered`, `cancelled`.
- `completed_at`, `delivered_at`, `delivery_confirmed_at`.
- `delivery_url`, `files_url`.
- `final_notes`.
- `archived_at`.
- `created_at`, `updated_at`.

Regras:

- `due_date >= start_date` quando ambos informados.
- `unique (source_link_id)` quando não nulo: uma conversão gera no máximo um projeto.
- Um contrato pode ter vários projetos manuais.
- A soma dos valores alocados a projetos não cancelados não pode exceder o total do contrato; o projeto de conversão recebe o total integral.
- FK composta `(owner_id, client_id, contract_id)` impede projeto de cliente diferente do contrato.
- O progresso não é gravado manualmente; é derivado das tarefas.
- Concluir/entregar não cria receita.

### 5.5 `project_tasks`

- `id uuid` PK.
- `owner_id uuid`.
- `project_id uuid not null`.
- `title text not null`.
- `description text`.
- `status text not null default 'pending'`: `pending`, `in_progress`, `completed`, `cancelled`.
- `responsible_name text`.
- `start_date date`.
- `due_date date`.
- `priority text not null default 'medium'`.
- `position integer not null default 0`.
- `notes text`.
- `completed_at`, `cancelled_at`.
- `created_at`, `updated_at`.

Regras:

- `due_date >= start_date` quando ambos informados.
- Tarefas podem ser reordenadas e excluídas com confirmação.
- Exclusão de tarefa é permitida; exclusão de registro financeiro não.
- Progresso = tarefas concluídas / tarefas não canceladas e não excluídas.
- Sem tarefas ativas, o progresso é `null` e a UI mostra “Sem tarefas ativas”.

### 5.6 `project_revisions`

- `id uuid` PK.
- `owner_id uuid`.
- `project_id uuid not null`.
- `requested_at timestamptz not null default now()`.
- `description text not null`.
- `responsible_name text`.
- `status text not null default 'requested'`: `requested`, `in_progress`, `completed`, `approved`.
- `completed_at`, `approved_at`.
- `notes`.
- `created_at`, `updated_at`.

Aprovação é registrada manualmente. Nenhuma mensagem é enviada automaticamente.

### 5.7 `client_activities`

Histórico unificado do cliente e do projeto.

- `id uuid` PK.
- `owner_id uuid`.
- `client_id uuid not null`.
- `project_id uuid` opcional.
- `contract_id uuid` opcional.
- `type text not null`: `conversion`, `contact`, `meeting`, `approval`, `status_change`, `delivery`, `financial`, `note`.
- `description text not null`.
- `metadata jsonb not null default '{}'`.
- `created_by uuid default auth.uid()`.
- `created_at timestamptz not null default now()`.

A ficha do cliente combina essas atividades com as timelines dos leads vinculados, sem copiar eventos antigos.

### 5.8 `expense_categories`

- `id uuid` PK.
- `owner_id uuid`.
- `name text not null`.
- `archived_at`.
- `created_at`, `updated_at`.
- `unique (owner_id, lower(name))`.

Categorias sugeridas: Hospedagem, Domínio, Ferramentas, Software, Marketing, Publicidade, Serviços terceirizados, Equipamentos e Outros. As sugestões são opções de interface; uma categoria só é persistida quando usada/criada pelo usuário. Nenhuma despesa é criada automaticamente.

### 5.9 `contract_installments`

- `id uuid` PK.
- `owner_id uuid`.
- `contract_id uuid not null`.
- `position integer not null`.
- `amount numeric(14,2) not null check (amount > 0)`.
- `due_date date not null`.
- `notes`.
- `created_at`, `updated_at`.

Regras:

- Parcelas são opcionais.
- Quando usadas, a soma das parcelas deve ser igual ao valor total do contrato.
- Sem parcelas, o vencimento geral do contrato é usado.
- O status da parcela é derivado dos pagamentos alocados e da data de vencimento.

### 5.10 `financial_payments`

- `id uuid` PK.
- `owner_id uuid`.
- `contract_id uuid not null`.
- `idempotency_key uuid not null unique`: gerada pela interface para cada ação de recebimento/estorno.
- `related_payment_id uuid`: obrigatório para `refund`, nulo para `receipt`.
- `type text not null`: `receipt`, `refund`.
- `amount numeric(14,2) not null check (amount > 0)`.
- `received_at timestamptz not null`.
- `payment_method text`.
- `notes`.
- `created_by uuid default auth.uid()`.
- `created_at`.

Regras:

- Recebido líquido = soma de `receipt` − soma de `refund`.
- Um RPC bloqueia o contrato antes de validar e inserir.
- Recebimento não pode exceder o saldo contratado.
- Estorno exige `related_payment_id` de um recebimento do mesmo contrato; a soma dos estornos vinculados não pode exceder o valor original nem tornar o recebido líquido negativo.
- Repetição com o mesmo `idempotency_key` retorna o pagamento existente, sem duplicar.
- Pagamento pode ser parcial, antecipado e alocado a uma ou mais parcelas.
- Registros nunca são excluídos; correções usam estorno/novo recebimento.

### 5.11 `financial_payment_allocations`

- `id uuid` PK.
- `owner_id uuid`.
- `contract_id uuid not null`.
- `payment_id uuid not null`.
- `installment_id uuid not null`.
- `amount numeric(14,2) not null check (amount > 0)`.
- `created_at`.

Regras:

- `unique (payment_id, installment_id)`.
- FKs compostas `(owner_id, contract_id, payment_id)` e `(owner_id, contract_id, installment_id)` amarram pagamento e parcela ao mesmo contrato/proprietário.
- Com parcelas configuradas, a soma das alocações deve ser igual ao valor do pagamento.
- Sem parcelas, o pagamento fica sem alocação e reduz o saldo do contrato.
- Recebimentos não podem exceder o saldo da parcela; estornos não podem reverter mais do que o recebido líquido alocado àquela parcela.

### 5.12 `financial_expenses`

- `id uuid` PK.
- `owner_id uuid`.
- `description text not null`.
- `category_id uuid`.
- `amount numeric(14,2) not null check (amount >= 0)`.
- `expense_date date not null`.
- `due_date date`.
- `paid_at timestamptz`.
- `payment_method text`.
- `status text not null default 'pending'`: `pending`, `paid`, `cancelled`.
- `project_id uuid` opcional.
- `contract_id uuid` opcional.
- `notes`.
- `cancelled_at`.
- `created_at`, `updated_at`.

Regras:

- Despesa paga exige `paid_at`.
- Atraso é derivado de `due_date < hoje` com status `pending`.
- Somente despesas `paid` entram no caixa e no lucro.
- Despesa pendente pode ser editada ou cancelada; despesa paga tem valor, data e status imutáveis, podendo apenas receber notas complementares.
- Despesa é cancelada, não excluída, quando possui histórico/dependências.

## 6. RLS e integridade

- RLS habilitado em todas as tabelas privadas.
- Policies de SELECT/INSERT/UPDATE para `owner_id = auth.uid()`; DELETE apenas onde a exclusão é segura e explicitamente necessária.
- Nenhum grant para `anon`; grants explícitos para `authenticated`.
- Tabelas e alocações financeiras concedem somente SELECT ao cliente; INSERT/UPDATE/DELETE financeiros são revogados e ocorrem exclusivamente por RPCs `security definer` com `search_path = ''`, nomes totalmente qualificados, validação explícita de `auth.uid()`/`owner_id`, `revoke all from public` e `grant execute` somente a `authenticated`.
- `client_activities` também é somente SELECT para o cliente; eventos são gravados por RPCs/triggers com as mesmas proteções de `security definer`.
- FKs compostas por `owner_id` ligam filhos a pais do mesmo usuário.
- Chaves únicas de suporte: `unique (owner_id, id)` em `leads`, `clients`, `lead_client_links`, `contracts`, `projects` e `expense_categories`; `unique (owner_id, client_id, id)` em `contracts` e `projects`; `unique (owner_id, contract_id, id)` em `contract_installments` e `financial_payments`.
- `source_link_id` usa FK composta `(owner_id, source_link_id)` para `lead_client_links`; `installment_id` e `related_payment_id` usam FKs compostas com `contract_id`.
- Índices por proprietário, status, datas, cliente/projeto/contrato e vencimentos.
- RPCs de leitura e operações ordinárias usam `security invoker`; RPCs com escrita financeira exclusiva usam `security definer` controlado conforme o §6. Todas usam `search_path = ''`, locks explícitos quando necessário e retorno JSONB.
- `service_role` não é usado no frontend nem nesta etapa.

## 7. Conversão idempotente

RPC: `convert_lead_to_client`.

Entrada:

- `lead_id`.
- Serviço, valor contratado, forma e condição de pagamento.
- Data da contratação.
- Observações.
- Nome do projeto, início e prazo, quando projeto opcional estiver selecionado.

Fluxo transacional:

1. `SELECT ... FOR UPDATE` no lead.
2. Validar propriedade e existência.
3. Consultar `lead_client_links` pelo lead bloqueado.
4. Se existir vínculo, retornar os IDs existentes e `already_existed = true`, sem alterar payload.
5. Se não houver vínculo e houver CNPJ, procurar cliente do mesmo proprietário com CNPJ canônico.
6. Criar cliente ou reutilizar cliente encontrado; todo cadastro usa `creation_key` para idempotência.
7. Criar vínculo, contrato e projeto opcional.
8. Definir lead como `aceitou` e gravar o valor contratado como snapshot comercial.
9. Registrar atividade `conversao` na timeline do lead; a migration 0006 amplia explicitamente o CHECK de `lead_activities.type` para incluir esse valor.
10. Registrar evento `conversion` em `client_activities`.
11. Retornar JSON com `client_id`, `link_id`, `contract_id`, `project_id` e `already_existed`.

Proteções:

- `unique (lead_id)` no vínculo.
- `unique (source_link_id)` em contrato e projeto.
- Repetição com dados diferentes retorna o existente; nunca sobrescreve silenciosamente.
- Falha em qualquer etapa reverte toda a operação.

## 8. Cadastro manual e edição de cliente

- `create_client` recebe `creation_key`, cria cliente + contrato inicial atomicamente e retorna o existente se a chave for repetida.
- `update_client` atualiza cliente + contrato inicial atomicamente; se o contrato já possuir parcelas/pagamentos, o valor é ajustado somente via `adjust_contract`.
- CNPJ duplicado bloqueia e informa qual cliente já existe.
- Demais suspeitas de duplicidade são avisos não bloqueantes.
- Após a conversão, `contracted_value` e `received_value` do lead ficam somente leitura; o contrato é a fonte financeira.
- Cliente sem contrato/projeto pode ser inativado/arquivado.
- Cliente com dependências não é excluído definitivamente.

## 9. Projetos, progresso e histórico

- Criação manual de projeto exige cliente e contrato.
- Prazo inicial é sugestão de 7 a 15 dias por tipo de serviço, sempre editável.
- Cards, lista e Kanban usam os mesmos dados.
- Kanban possui serialização por projeto, atualização otimista, resposta confirmada e rollback condicional.
- Alteração de status registra evento no histórico.
- Tarefas e revisões têm loading, vazio, erro e confirmação nas ações relevantes.
- Aprovação de revisão e entrega são ações explícitas.
- Entrega registra data, links, confirmação e notas finais.
- Nenhuma conclusão/entrega cria ou altera receita.

## 10. Regras financeiras

- Contratado ativo = soma de contratos não cancelados.
- Recebido líquido histórico = todos os recebimentos − estornos, inclusive movimentos de contratos posteriormente cancelados.
- Pendente = soma dos saldos dos contratos ativos; cada saldo é o total do contrato menos os recebimentos líquidos daquele contrato, nunca negativo.
- Status financeiro do contrato/parcela é derivado: pendente, parcialmente pago, pago ou atrasado.
- Lucro do período = recebimentos líquidos com data efetiva no período − despesas pagas com data efetiva no período.
- Caixa usa `received_at` e `paid_at`, nunca data de contrato/vencimento.
- Cancelar contrato remove seus valores dos totais ativos de contratado/pendente, mas não apaga recebimentos ou estornos já realizados.
- Datas de agrupamento usam `America/Sao_Paulo`.
- Períodos: diário, semanal, mensal, anual e personalizado com início inclusivo e fim exclusivo.
- Saldo acumulado considera todos os lançamentos anteriores ao início do período.
- Próximos pagamentos e vencidos vêm de parcelas; sem parcelas, usam o saldo remanescente do contrato e seu vencimento geral.
- Contratos cancelados não entram nos totais ativos de contratado/pendente; despesas canceladas não entram em despesas pagas. Movimentos financeiros efetivos já registrados permanecem no caixa e no histórico.

## 11. Agregações e gráficos

RPC `get_financial_summary` retorna:

- Total contratado.
- Total recebido líquido histórico.
- Total pendente.
- Recebimentos do período.
- Despesas pagas do período.
- Lucro do período.
- Valor vencido.
- Próximos vencimentos.

RPC `get_cash_flow` retorna buckets por período com recebimentos, despesas pagas, saldo do período e saldo acumulado.

Gráficos Recharts:

- Receitas por mês.
- Despesas por mês.
- Lucro por mês.
- Contratado versus recebido.
- Despesas por categoria.
- Pagamentos pendentes.

Todos os gráficos usam dados reais do Supabase e possuem estado vazio quando não há registros.

## 12. Rotas e componentes

- `/clientes`: lista com busca, filtros, cards/tabela e criação manual.
- `/clientes/novo`: formulário de cliente + contrato inicial.
- `/clientes/:id`: abas Visão geral, Projetos, Financeiro e Histórico.
- `/projetos`: cards/lista/Kanban com filtros.
- `/projetos/novo`: formulário vinculado a cliente e contrato.
- `/projetos/:id`: visão, tarefas, revisões e entrega.
- `/financeiro`: visão geral, receitas, despesas e fluxo de caixa.

Novos serviços seguirão o padrão de `leadService`/`followupService`: Supabase direto, normalização na fronteira, erros em pt-BR e sem nova dependência de estado assíncrono.

## 13. Tratamento de erros e concorrência

- Diálogos de conversão, pagamento, estorno, cancelamento e exclusão possuem estado de salvamento e bloqueio contra duplo clique.
- Respostas obsoletas são descartadas por flag de componente ativo e versão de mutação.
- Kanban de projetos reutiliza o padrão de fila por ID já validado no Pipeline de leads.
- RPCs são usados em toda operação multi-registro ou que altere saldo financeiro.
- Erros de banco são traduzidos para mensagens compreensíveis, sem expor detalhes internos.
- Falha de refresh mantém o último dado válido e exibe opção de tentar novamente.

## 14. Migrations e ordem de entrega

- `0006_etapa3_clients.sql`: clientes, vínculos, contratos, projetos básicos, RPCs de cliente/conversão, RLS, ajuste de `lead_activities` e ampliação das colunas monetárias de `leads` para `numeric(14,2)`.
- `0007_etapa3_projects.sql`: tarefas, revisões, histórico do cliente, índices, triggers e regras de progresso/status.
- `0008_etapa3_finance.sql`: categorias, parcelas, pagamentos, despesas, RPCs financeiros e agregações.

As migrations são aditivas e não apagam dados da Etapa 2. A aplicação no Supabase será feita pelo usuário no SQL Editor e só será dada como concluída após confirmação/validação real.

## 15. Testes e critérios de aceite

### Testes automatizados

- Centavos, formatação e conversão de dinheiro.
- Progresso com tarefas concluídas, canceladas e excluídas.
- Datas, vencidos, saldos, estornos e lucro.
- Serviços e contratos das RPCs.
- Formulários, filtros, estados vazios e erros.
- Kanban com mutações concorrentes e respostas fora de ordem.
- Idempotência da conversão no nível de contrato de serviço e SQL/RPC.
- Build, lint e suíte completa sem regressões.

### Validação real

- Login autenticado e persistência no Supabase.
- Conversão repetida sem duplicar cliente/contrato/projeto.
- Pagamento parcial, saldo e estorno.
- Despesa paga entrando no caixa/lucro.
- Projeto concluído sem gerar nova receita.
- Responsividade em 375, 768 e 1280 px.
- RLS entre dois usuários somente será marcado como aprovado após criação de segunda conta temporária, teste de isolamento e remoção da conta.

### Critérios de aceite

- Um lead convertido gera no máximo um cliente, um contrato e um projeto de conversão.
- Clientes, projetos e financeiro estão acessíveis pelas rotas protegidas.
- Contratado, recebido e pendente são exibidos separadamente.
- Nenhum valor estimado de oportunidade entra no faturamento.
- Nenhuma conclusão de projeto duplica receita.
- Todos os registros novos respeitam RLS e proprietário.
- Nenhuma credencial real aparece no código, migrations, docs, testes ou Git.

## 16. Decomposição em planos

1. **Plano 1 — Clientes e conversão:** schema fundacional, RPC idempotente, tipos/serviços, lista/formulário/detalhe, integração com lead/Pipeline e testes.
2. **Plano 2 — Projetos e produção:** tarefas, revisões, histórico, cards/lista/Kanban, progresso e entrega.
3. **Plano 3 — Financeiro:** contratos adicionais, parcelas, pagamentos/estornos, despesas/categorias, agregações, fluxo de caixa e gráficos.

Cada plano produz software funcional e testável antes do próximo. A Etapa 4 não se inicia sem autorização explícita.
