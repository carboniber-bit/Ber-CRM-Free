# Relatório final — Plano 1 fix wave

- **Status:** DONE_WITH_CONCERNS
- **Data:** 2026-11-24
- **Branch:** `main`
- **Base:** `a77cb5f9e543b7e7f77888d1c9c98e439eca6ac4`
- **Commit de implementação:** `c4f9b91aba0cb86dc6e8b7c807663cc9c90ed638` — `fix: corrige integridade e acessibilidade do Plano 1`
- **Push:** `git push origin main` concluído sem force: `a77cb5f..c4f9b91  main -> main`.

Os concerns são exclusivamente os gates de runtime explicitamente diferidos: a migration 0002 não foi executada e não há validação PostgreSQL/PostgREST/RLS em dois usuários. Não há bloqueio para a entrega do código verificado localmente.

## Arquivos alterados

### Banco
- `supabase/migrations/0002_etapa2.sql`

### Tipos e serviços
- `src/types/lead.ts`
- `src/services/leadService.ts`
- `src/services/followupService.ts`
- `src/services/settingsService.ts`

### Bibliotecas e testes
- `src/lib/whatsapp.ts`
- `src/lib/whatsapp.test.ts`
- `src/lib/csv.ts`
- `src/lib/csv.test.ts`
- `src/lib/opportunity.test.ts`

### UI
- `src/components/ui/Select.tsx`
- `src/components/ui/Textarea.tsx`
- `src/components/ui/Modal.tsx`
- `src/components/ui/ConfirmDialog.tsx`
- `src/components/ui/Toast.tsx`
- `src/components/ui/ScoreBar.tsx`
- `src/layouts/AppLayout.tsx`

### Relatório
- `.superpowers/sdd/2026-11-22-etapa2-plano1-fundacao/final-fix-report.md`

Diff de implementação autorrevisado: 17 arquivos, 535 inserções e 81 remoções.

## Correções por achado

### 1. Isolamento de tenant nas tabelas filhas

- Adicionado `public.owns_lead(uuid)`, em SQL estável, `security invoker` e `search_path = ''`.
- A helper consulta `public.leads` sob o contexto do chamador. A política de leads não chama a helper, portanto não há recursão de RLS.
- `select`, `insert`, `update` e `delete` de atividades, follow-ups e checks agora exigem simultaneamente `auth.uid() = owner_id` e `public.owns_lead(lead_id)`.
- Políticas de update aplicam a condição em `using` e `with check`, impedindo também mover um filho para o lead de outro tenant.
- `lead_activities.user_id` aceita somente `NULL` ou `auth.uid()`.
- Grants de tabela continuam exclusivos para `authenticated`; nenhum grant anon foi adicionado.
- Migration envolvida em `BEGIN`/`COMMIT`.
- Removido o índice redundante `lead_digital_checks_lead_idx`; `unique (lead_id, item)` já cobre a coluna inicial.

### 2. Transição de status e histórico atômicos

- Criado `public.log_lead_status_change()` com `security invoker`, `search_path = ''` e trigger `AFTER UPDATE OF status`.
- O trigger insere uma única atividade `mudanca_status` somente quando `OLD.status IS DISTINCT FROM NEW.status`.
- `owner_id`, `lead_id` e `user_id` vêm do lead atualizado e de `auth.uid()`; labels são legíveis em pt-BR.
- O insert ocorre na mesma transação do update, inclusive para REST direto.
- `setLeadStatus` deixou de ler o lead antes e de inserir atividade em segunda chamada; agora faz apenas o update condicional por ID e retorna o lead atualizado.
- Uma chamada com o mesmo status não gera histórico.

### 3. Timestamps não são mais escritas genéricas

- `next_contact_at` e `last_verified_at` foram removidas de `LeadWrite` e de `emptyLeadDraft()`.
- Os campos permanecem no modelo de leitura `Lead`.
- Follow-ups e checks digitais continuam sendo os únicos owners das mutações desses timestamps.

### 4. Paginação determinística

- `listLeads` acrescenta `.order('id', { ascending: true })` após o ordenamento principal escolhido.

### 5. Duplicidades canônicas e limitadas

- Adicionado `normalizePhoneForComparison`: usa a normalização brasileira existente e cai para dígitos somente em identificadores inválidos não vazios.
- CNPJ continua comparado somente por dígitos.
- Variantes de telefone/WhatsApp são consultadas via `.or(...)`: valor original, canônico, doméstico, `+55`, formato brasileiro e dígitos.
- Nome e cidade exatos são consultados separadamente com `.ilike`, quando ambos existem.
- Ambas as consultas têm limite explícito de 100 candidatos e ordenação por ID.
- Resultados são mesclados e deduplicados por ID, excluindo o lead atual.
- A comparação final é canônica e exata em memória; não há mais scan irrestrito da tabela.

### 6. Integridade de CSV

- Dinheiro aceita vazio como zero, inteiros, formas decimais com ponto, formas com vírgula e agrupamentos pt-BR documentados.
- Rejeita formas ambíguas, separadores mistos, mais de duas casas, notação científica, sinais, valores não finos e acima de `numeric(12,2)`.
- Erros estruturais PapaParse invalidam a linha afetada; campos extras não são silenciosamente descartados.
- O aviso não estrutural `UndetectableDelimiter` não invalida um CSV válido de uma coluna.
- País vazio permanece `null`; o default interativo `Brasil` foi preservado.
- Scanner quote-aware mantém a linha física inicial após linhas vazias e registros multilinha, em LF e CRLF.
- Exportação protege células com primeiro caractere não espaçado `=`, `+`, `-` ou `@`, além de prefixos tab/CR.
- Exportação mantém os 30 cabeçalhos e separadores de registro LF.
- Nenhuma coluna de data ou timestamp foi inventada, conforme o ruling do contrato CSV.

### 7. Filtro de prioridade

- `LeadFilters` ganhou `priority?: Priority`.
- `listLeads` aplica `.eq('priority', filters.priority)`.

### 8. Associação de erros em formulários

- Select e Textarea geram IDs estáveis com `useId`.
- O parágrafo de erro recebe o ID e o controle recebe `aria-describedby`.
- IDs fornecidos pelo chamador são preservados; `aria-describedby` externo é combinado com o erro; `aria-invalid` existente foi preservado.

### 9. Modal não dispensável

- `Modal` ganhou `dismissible?: boolean`, default `true`.
- Com `false`, backdrop e Escape não chamam `onClose`; o botão de fechar é omitido.
- `ConfirmDialog` passa `dismissible={!loading}`.
- Trap de Tab e restauração de foco foram preservados. Um efeito adicional mantém o foco dentro do diálogo quando os controles ficam desabilitados.

### 10. Drawer mobile

- Navegação do drawer usa `min-h-0 flex-1 overflow-y-auto`; header permanece fora da área de scroll e com `shrink-0`.
- Foco retorna ao hamburger apenas se ele estiver conectado, visível, habilitado e fora de contexto inert.
- Texto normal de itens bloqueados e labels de etapa usam `text-muted`, sem opacidade reduzida.

### 11. Endurecimentos adicionais

- Complete/cancel de follow-up exigem status `pendente`; atividades e sincronização só ocorrem após transição real.
- `deleteLead` exige linha retornada pelo delete e lança erro pt-BR claro em no-op/RLS.
- Settings falha explicitamente em erro de autenticação ou sessão ausente; preços default são clonados.
- Toast limpa todos os timers no unmount; erros usam `role="alert"` e sucesso/info usam `role="status"`.
- ScoreBar expõe `role="progressbar"`, nome acessível e valores min/max/current, com clamp 0–100.
- Testes de oportunidade afirmam o máximo atual exato de 90 e as razões exatas.

## Evidência TDD

### CSV obrigatório

**RED inicial**

```text
npm test -- src/lib/csv.test.ts
Exit code 1
Test Files  1 failed (1)
Tests       29 failed | 26 passed (55)
Duration    585ms
```

As 29 falhas esperadas cobriram exportação vulnerável a fórmulas, dinheiro permissivo/fora de escala, erros estruturais ignorados, linhas físicas incorretas e país implícito Brasil.

**GREEN inicial**

```text
npm test -- src/lib/csv.test.ts
Exit code 0
Test Files  1 passed (1)
Tests       55 passed (55)
Duration    275ms
```

**RED adicional de autorrevisão**

```text
npm test -- src/lib/csv.test.ts
Exit code 1
Test Files  1 failed (1)
Tests       1 failed | 55 passed (56)
Duration    283ms
```

O caso novo expôs que o aviso de detecção automática de delimitador invalidava indevidamente a primeira linha de um CSV válido de uma coluna.

**GREEN adicional**

```text
npm test -- src/lib/csv.test.ts
Exit code 0
Test Files  1 passed (1)
Tests       56 passed (56)
Duration    266ms
```

### Normalização de telefone

```text
RED:   9 failed | 9 passed (18)
GREEN: 18 passed (18)
```

## Verificação final

### Focados

```text
npm test -- src/lib/csv.test.ts src/lib/whatsapp.test.ts src/lib/opportunity.test.ts
Test Files  3 passed (3)
Tests       86 passed (86)
Duration    302ms
```

### Suíte completa

```text
npm test
Test Files  4 passed (4)
Tests       94 passed (94)
Duration    333ms
```

Arquivos: `opportunity.test.ts` (12), `whatsapp.test.ts` (18), `csv.test.ts` (56), `format.test.ts` (8).

### Build

```text
npm run build
tsc -b && vite build
2201 modules transformed
dist/assets/index-BiOaiWW-.js  506.03 kB │ gzip: 147.79 kB
built in 884ms
```

Somente o advisório conhecido de chunk acima de 500 kB; nenhum erro.

### Lint

```text
npm run lint
Found 1 warning and 0 errors.
Finished in 18ms on 57 files with 116 rules using 12 threads.
```

Único warning aceito: `react(set-state-in-effect)` em `src/pages/StatusPage.tsx:123`.

### Diff check

```text
git diff --check
Exit code 0
```

Foram emitidos somente os advisórios existentes de conversão LF/CRLF do Git, sem erros de whitespace.

## Verificação no navegador

Foi realizado login real novo com a conta de teste autorizada. Ao final, o usuário saiu e a rota retornou a `/login`. Nenhuma credencial foi gravada em arquivo, captura, log, commit ou relatório.

Os viewports exatos foram exercitados em iframes same-origin. Isto valida layout/CSS e comportamento DOM, mas **não é teste em dispositivo físico**.

### RED de UI antes das correções

- Select/Textarea: parágrafos de erro sem ID e controles sem associação com o erro.
- ScoreBar: sem role, nome ou valores acessíveis.
- Modal/ConfirmDialog: botão de fechar presente e habilitado; backdrop/Escape podiam chamar `onClose` mesmo com dismissão bloqueada.
- Toast: erro, sucesso e info todos com `role="status"`; três timers ativos e zero limpos no unmount.
- Drawer 375×400: navegação com `overflow-y: visible`, `clientHeight = scrollHeight = 392`, último item até 460 enquanto o drawer terminava em 400 e `scrollTop` permanecia 0.
- Ao mudar o iframe para desktop, o hamburger oculto recebeu uma chamada de foco.

### GREEN de UI após as correções

- Select: `aria-describedby="external-hint probe-select-error"`; ID do erro existente e resolvível.
- Textarea: `aria-describedby="probe-textarea-error"`; associação resolvível.
- ScoreBar: `progressbar`, label `Pontuação da oportunidade`, min 0, max 100, current 90.
- Modal não dispensável: zero chamadas de backdrop, Escape e close; trap de Tab manteve o foco no primeiro controle.
- Modal padrão: backdrop, Escape e close chamaram `onClose` uma vez cada; foco restaurado ao opener.
- ConfirmDialog loading: sem botão de fechar, cancel/confirm desabilitados, zero chamadas de cancel e foco no diálogo.
- Toast: erro `alert`, sucesso/info `status`; três timers limpos no unmount; após 4,25 s não restaram toasts.
- Drawer 375×400: `overflow-y: auto`, `clientHeight = 316`, `scrollHeight = 392`, `scrollTop = 76`; header permaneceu em 44 e último item terminou em 384, dentro do drawer.
- Contraste medido do texto bloqueado e do label de etapa: **7,17:1**.
- Foco oculto no breakpoint desktop: zero chamadas.
- Drawer 375×812: foco inicial no close, Tab/Shift+Tab circulam, Escape e botão de fechar restauram o hamburger.

### Viewports e páginas

| Verificação | Resultado |
|---|---|
| Dashboard 1280×800 | Sem overflow horizontal; hamburger oculto |
| Dashboard 375×812 | Sem overflow horizontal; hamburger visível |
| Drawer 375×400 | Scroll independente e header fixo |
| `/status` 1280×800 | Sem overflow; verificações existentes todas OK |
| `/status` 375×812 | Sem overflow; verificações existentes todas OK |
| Console | Nenhuma mensagem error/warn/issue |
| Limpeza | Zero iframes e zero nós de probe temporários |

O `/status` OK cobre variáveis, health, sessão e leitura de `profiles`; não comprova a migration 0002.

## Autorrevisão e gates restantes

- Diff completo revisado quanto a escopo, isolamento, atomicidade, consultas limitadas, acessibilidade e ausência de segredos.
- Nenhum registro falso lead foi criado; não houve escrita no banco nem automação de WhatsApp.
- Nenhum SQL foi executado e nenhuma credencial foi usada em acesso direto ao Supabase.
- Servidor Vite temporário foi encerrado; probes e iframes foram removidos; logout confirmado.
- Permanecem deferidos, conforme o brief:
  - executar a migration 0002 e validar sintaxe/comportamento PostgreSQL;
  - smoke REST autenticado comprovando exatamente um histórico por mudança real e zero para status igual;
  - teste RLS com dois usuários para acesso cruzado nos filhos;
  - validação runtime da sintaxe `.or(...)` gerada para duplicidades;
  - comportamento PostgREST de `hasNeeds`, que não faz parte desta onda.
- Permanecem fora do escopo: colunas derivadas graváveis pelo cliente, concorrência de `syncNextContact`, portal/body-scroll/inert amplos do Modal, aliases de presença, timezone de datas, limpeza de EOF e code splitting.

## Entrega

- Implementação commitada em `main`: `c4f9b91aba0cb86dc6e8b7c807663cc9c90ed638`.
- Push `origin main` concluído sem force.
- O relatório está neste caminho e será commitado em seguida; o `.gitignore` de `.superpowers/sdd` não foi alterado.
