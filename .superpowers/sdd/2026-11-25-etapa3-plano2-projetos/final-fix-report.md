# Relatório — fix round final do Plano 2 de Projetos

- Data: 2026-11-28
- Branch: `main`
- Base: `b046c7fa9cd90cd866e34bc9bdc21f51bcb4b34d`
- Range de implementação revisado: `b046c7f..e4867ec`
- Status: **concluído, com gate local aprovado e ressalvas runtime explícitas**
- Escopo: exclusivamente os achados Important I1–I5 do `final-review.md`, conforme `final-fix-brief.md`.

Não houve push, deploy, amend, squash, force push, acesso ao Supabase, navegador, credenciais ou aplicação de SQL remoto. Não houve subagentes. Plano canônico, README, ledger e relatório de revisão não foram alterados.

## Commits

1. `b6d8bc4 fix: paginar tarefas e revisoes de projetos`
2. `eff057f fix: permitir cascatas de tarefas sem claim JWT`
3. `e9abff4 fix: preservar tarefas confirmadas no detalhe do projeto`
4. `80a8a2d fix: preservar edição e entrega confirmadas no detalhe`
5. `bc925b6 fix: priorizar entrega externa na reconciliação do Kanban`
6. `e4867ec fix: sincronizar refs de projetos fora do render`

O commit de fechamento que adiciona este relatório é separado; seu hash está na devolutiva final ao controller.

## Arquivos alterados

### I1 — paginação

- `src/services/projectTaskService.ts`
- `src/services/projectTaskService.test.ts`
- `src/services/projectRevisionService.ts`
- `src/services/projectRevisionService.test.ts`

### I2 — cascata administrativa

- `supabase/migrations/0008_etapa3_projects.sql`
- `supabase/tests/etapa3_projects.sql`

### I3 — tarefas confirmadas

- `src/components/projects/ProjectTaskList.tsx`
- `src/components/projects/ProjectTaskList.test.tsx`
- `src/pages/ProjectDetailPage.tsx`
- `src/pages/ProjectDetailPage.test.tsx`

### I4 — edição e entrega confirmadas

- `src/components/projects/ProjectForm.tsx`
- `src/components/projects/ProjectForm.test.tsx`
- `src/components/projects/ProjectDeliveryPanel.tsx`
- `src/components/projects/ProjectDeliveryPanel.test.tsx`
- `src/pages/ProjectDetailPage.tsx`
- `src/pages/ProjectDetailPage.test.tsx`

### I5 — reconciliação do Kanban

- `src/hooks/useProjectStatusQueue.ts`
- `src/hooks/useProjectStatusQueue.test.tsx`

### Fechamento autorizado

- `.superpowers/sdd/2026-11-25-etapa3-plano2-projetos/final-fix-report.md`

## Evidências TDD

### I1 — paginação de tarefas e revisões

**Causa:** `listTasks` e `listRevisions` faziam uma única consulta, sem `.range()`. O limite padrão do PostgREST podia truncar silenciosamente tarefas, revisões e o payload de reordenação. Revisões também não tinham desempate determinístico por `id`.

**RED — comando executado:**

```bash
npm test -- src/services/projectTaskService.test.ts src/services/projectRevisionService.test.ts
```

**Falha observada:** 2 arquivos falharam; **7 testes falharam e 6 passaram**. As regressões com 1.001 registros observaram uma chamada em vez de duas, ausência de `.range()`, resultado sem a segunda página e promessa resolvida em vez de rejeitar na falha da segunda página. A reordenação recebeu lista incompleta.

**Implementação:** ambos os serviços agora percorrem páginas de 1.000 com `.range(from, from + 999)`, acumulam resultados e propagam erro de qualquer página. Tarefas usam `position` e depois `id`; revisões usam `requested_at desc` e depois `id asc`.

**GREEN — comando executado:**

```bash
npm test -- src/services/projectTaskService.test.ts src/services/projectRevisionService.test.ts
```

**Resultado:** 2 arquivos; **13 testes passaram**. Os testes verificam ranges `0..999` e `1000..1999`, duas chamadas, ordem completa, resultado acumulado, reordenação com 1.001 IDs e falha na segunda página.

Nota: no primeiro GREEN, dois testes esperavam a mensagem bruta do mock de erro, enquanto `throwDbError` normaliza a mensagem. Apenas as expectativas foram alinhadas ao contrato real; o comportamento de produção foi preservado e a suíte foi reexecutada.

### I2 — cascata administrativa sem claim JWT

**Causa:** `lock_project_task_mutations` levantava `42501` quando `auth.uid()` era nulo, inclusive em deleções por `ON DELETE CASCADE` executadas por papel privilegiado.

**RED — comando executado:**

```bash
node --input-type=module -e "import fs from 'node:fs'; const sql=fs.readFileSync('supabase/migrations/0008_etapa3_projects.sql','utf8'); const fn=sql.split('create or replace function public.lock_project_task_mutations()')[1].split('create trigger project_tasks_lock_mutations')[0]; if (!/if v_owner is null then\s+return;\s+end if;/.test(fn)) { console.error('RED estatico: lock_project_task_mutations ainda lanca 42501 quando auth.uid() e nulo.'); process.exit(1); } console.log('GREEN estatico: caminho nulo retorna antes da advisory.');"
```

**Falha observada:** exit code 1, com `RED estatico: lock_project_task_mutations ainda lanca 42501 quando auth.uid() e nulo.`

**Implementação:** somente o caminho nulo da função passou a retornar antes da advisory lock. Operações autenticadas continuam adquirindo o lock; RLS e grants não foram alterados. O teste SQL ganhou cascatas de projeto e de usuário com `request.jwt.claim.sub` explicitamente vazio, verificando remoção de tarefas/revisões e ausência de históricos órfãos.

**GREEN — comando executado:** o mesmo checker, com a regex corrigida para aceitar tanto `return;` quanto `return null;`, reexecutado após a implementação e novamente no gate final.

```bash
node --input-type=module -e "import fs from 'node:fs'; const sql=fs.readFileSync('supabase/migrations/0008_etapa3_projects.sql','utf8'); const fn=sql.split('create or replace function public.lock_project_task_mutations()')[1].split('create trigger project_tasks_lock_mutations')[0]; if (!/if v_owner is null then\s+return(?: null)?;\s*end if;/.test(fn)) { console.error('RED estatico: lock_project_task_mutations ainda lanca 42501 quando auth.uid() e nulo.'); process.exit(1); } console.log('GREEN estatico: caminho nulo retorna antes da advisory.');"
```

**Resultado:** exit code 0 e `GREEN estatico: caminho nulo retorna antes da advisory.`

O primeiro GREEN com o checker inicial falhou porque ele só aceitava `return;`, enquanto a implementação usa `return null;`. Somente o checker foi corrigido; a produção não foi alterada para acomodar a verificação.

**Limitação:** o SQL não foi executado. A evidência é estática e o teste SQL foi inspecionado, não executado em Supabase/PostgreSQL.

### I3 — preservar mutações confirmadas de tarefas

**Causa:** `perform` descartava os retornos de criar/editar/status, não removia localmente a exclusão, não aplicava a nova ordem e só notificava o detalhe após um refresh bem-sucedido. Falha de refresh ou troca de aba podia reverter visualmente uma escrita confirmada.

**RED — comando executado:**

```bash
npm test -- src/components/projects/ProjectTaskList.test.tsx src/pages/ProjectDetailPage.test.tsx
```

**Falha observada:** 2 arquivos; **8 testes falharam e 30 passaram**. Evidências: status continuou `pending` em vez de `completed`; criação/editada não apareceram; exclusão deixou a tarefa visível; ordem permaneceu `['Primeira', 'Segunda']`; callback não foi chamado após desmontar apenas a aba; métricas do detalhe não foram atualizadas.

**Implementação:** criar/editar/status passaram a aplicar upsert por `id`; exclusão remove localmente; reordenação aplica a ordem confirmada. Todas as operações filtram pelo projeto corrente, atualizam o estado antes do refresh e notificam o detalhe com a lista confirmada. O detalhe recalcula e mescla métricas antes do refresh. Estado confirmado permanece visível quando o refresh falha. Callbacks sobrevivem à desmontagem da aba, mas respostas de projeto/rota antiga são descartadas.

**GREEN — comando executado:** o mesmo comando RED.

**Resultado:** 2 arquivos; **38 testes passaram**.

### I4 — preservar edição e entrega no detalhe

**Causa:** edição e entrega apenas disparavam refresh quando ainda montadas; o `Project` confirmado não era mesclado no detalhe. O modal de edição podia ser fechado durante o save.

**RED — comando executado:**

```bash
npm test -- src/components/projects/ProjectForm.test.tsx src/components/projects/ProjectDeliveryPanel.test.tsx src/pages/ProjectDetailPage.test.tsx
```

**Falha observada:** 3 arquivos; **8 testes falharam e 47 passaram**. Evidências: heading `Site atualizado` ausente após refresh falho; `Entregue` ausente; formulário de entrega reapareceu; callbacks não foram chamados após desmontagem da mesma instância; edição de projeto anterior foi indevidamente comunicada; Escape e backdrop fecharam o modal durante saving.

**Implementação:** o detalhe mescla por `id` o `Project` confirmado antes do refresh, preservando `client_name`, métricas, `tasks`, `revisions` e `activities`. `ProjectForm` comunica edição confirmada após desmontagem da mesma instância, mas descarta projeto anterior e criação após sair da página. `ProjectDeliveryPanel` comunica entrega confirmada após desmontagem da aba, com guards de identidade no wrapper e no pai. O modal recebe `onSavingChange` e fica `dismissible={false}` durante o save, com guard adicional em `onClose`.

**GREEN — comando executado:** o mesmo comando RED.

**Resultado:** 3 arquivos; **55 testes passaram**.

O teste antigo que fixava o descarte indevido do callback após desmontagem foi atualizado para exigir comunicação da mesma instância, mantendo os cenários de descarte de projeto/rota antiga.

### I5 — `delivered` vence reconciliação do Kanban

**Causa:** `reconcileExternalProject` sempre substituía o status externo pelo baseline confirmado/local, podendo rebaixar um snapshot externo `delivered`.

**RED — comando executado:**

```bash
npm test -- src/hooks/useProjectStatusQueue.test.tsx
```

**Falha observada:** **2 testes falharam e 14 passaram**. Com a RPC local resolvendo, o status recebido foi `planning` em vez de `delivered`; com a RPC rejeitando, foi `not_started` em vez de `delivered`.

**Implementação:** snapshot externo `delivered` agora vence a reconciliação tanto na resolução quanto na rejeição local, preserva os campos externos e atualiza `confirmedStatusRef` para evitar rollback ou novo movimento futuro. Serialização, última intenção e refresh adiado foram preservados.

**GREEN — comando executado:** o mesmo comando RED.

**Resultado:** **16 testes passaram**. Os cenários verificam resolução e rejeição sem refresh posterior, campos externos, `pendingIds`, `onChange`, ausência de refresh e impossibilidade de novo movimento. Um teste adicional preserva o rollback não terminal para snapshot externo não entregue.

## Verificação focada final

Comando:

```bash
npm test -- src/services/projectTaskService.test.ts src/services/projectRevisionService.test.ts src/components/projects/ProjectTaskList.test.tsx src/pages/ProjectDetailPage.test.tsx src/components/projects/ProjectForm.test.tsx src/components/projects/ProjectDeliveryPanel.test.tsx src/hooks/useProjectStatusQueue.test.tsx
```

Resultado: **7 arquivos e 105 testes passaram**.

## Gate completo final

| Gate | Resultado real |
|---|---|
| `npm test` | **59 arquivos e 1.011 testes passaram** |
| `npm run build` | Aprovado; 2.685 módulos; bundle principal `1.279,92 kB`, gzip `360,58 kB`; aviso conhecido de chunk acima de 500 kB |
| `npm run lint` | **0 erros e 16 avisos** em 171 arquivos, 116 regras |
| `git diff --check b046c7f..HEAD` | Aprovado, sem saída |
| `git diff --cached --check` | Aprovado, sem saída |

A auto-revisão identificou avisos `react(refs)` introduzidos pela escrita de refs durante o render em I3/I4. Eles foram removidos movendo a sincronização para `useLayoutEffect` no commit `e4867ec`. As suítes focadas, a suíte completa, build, lint e checagens de diff foram reexecutados após esse ajuste.

## Limitações

- SQL runtime não executado; nenhuma migration foi aplicada em Supabase ou PostgreSQL.
- RLS real entre dois usuários autenticados não validada; `set_config` e testes SQL estáticos não substituem sessões/JWTs reais.
- Nenhum navegador ou sessão autenticada foi acessado.
- Responsividade e comportamento visual em viewport real não foram verificados neste fix round.
- Testes de UI usam Testing Library/jsdom com serviços mockados; paginação, PostgREST e o limite efetivo de linhas não foram observados em runtime.
- `/status` não valida migrations `0006`–`0008`, projetos ou RLS cruzado e não foi usado como evidência de fechamento.

## Concerns e desvios

- Permanecem **16 avisos preexistentes de lint**, sem erros; nenhum aviso novo de refs foi deixado nos componentes alterados.
- O bundle principal continua acima de 500 kB, com o aviso Vite já conhecido.
- SQL runtime, RLS entre dois usuários, browser autenticado e responsividade continuam pendentes e devem ser tratados em gates próprios.
- Os Minors M1–M4 da revisão não foram alterados, pois o brief autorizou somente I1–I5.
- A revisão foi realizada pelo implementador único, sem revisor independente/subagente, conforme a restrição explícita do brief.
- Não houve desvio de arquivos autorizados além do relatório final solicitado.

## Adendo pós-re-revisão — N1/I5 e correção residual

- Commits: `340d86c docs: registrar fix round final do Plano 2` e `71d7a01 fix: preservar entrega externa no estado do Kanban`.
- A primeira re-revisão (`final-fix-rereview.md`) aprovou I1–I4 e manteve I5 aberto por N1: a reconciliação de `delivered` alterava apenas o estado interno, enquanto `ProjectsPage` realimenta o hook por `onChange={setBoardProjects}` e podia rebaixar o estado terminal.
- RED inicial das regressões com estado controlado real: **3 testes falharam e 16 passaram**. A correção fez a reconciliação terminal passar por `updateProjects`, atualizando estado interno e pai.
- Uma regressão adicional revelou que a atualização de outro projeto em paralelo ainda podia substituir o snapshot externo `delivered` pendente. RED específico: **1 teste falhou e 19 passaram**. O guard passou a preservar o snapshot terminal pendente contra incoming não entregue.
- GREEN final: `npm test -- src/hooks/useProjectStatusQueue.test.tsx src/pages/ProjectsPage.test.tsx` — **2 arquivos e 37 testes passaram**. O hook usa `useState` real e a página renderiza `ProjectsPage` real, verificando read-only e coluna Entregue após sucesso e rejeição da RPC.
- A segunda re-revisão (`final-fix-rereview-2.md`, range `340d86c..71d7a01`) concluiu **N1/I5 RESOLVED**, com **0 Critical, 0 Important e 1 Minor**, veredito **APPROVED**.
- Ruling: R1 Minor fica parkado como não bloqueador. Quando o baseline já é `delivered`, snapshots novos com o mesmo status não atualizam metadados não terminais; o status terminal permanece correto e a frescor desses campos depende de remontagem ou saída/retorno do item. Custo se incorreto: metadados podem permanecer antigos até esse evento, sem rebaixar a entrega.

### Gate completo fresco após `71d7a01`

| Gate | Resultado real |
|---|---|
| `npm test` | **59 arquivos e 1.017 testes passaram** |
| `npm run build` | Aprovado; 2.685 módulos; bundle principal `1.280,10 kB`, gzip `360,63 kB`; aviso conhecido de chunk acima de 500 kB |
| `npm run lint` | **0 erros e 16 avisos** em 171 arquivos, 116 regras |
| `git diff --check` | Aprovado, sem saída; somente aviso de conversão LF/CRLF |
| `git diff --cached --check` | Aprovado, sem saída |

O commit do alinhamento documental e o push são registrados no ledger de fechamento.
