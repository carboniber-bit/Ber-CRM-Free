-- supabase/tests/etapa3_projects.sql
begin;

do $$
declare
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_today date := DATE '2026-02-01';
  v_client jsonb;
  v_client_id uuid;
  v_contract_id uuid;
  v_project jsonb;
  v_second jsonb;
  v_project_id uuid;
  v_second_project_id uuid;
  v_delivered jsonb;
  v_repeated jsonb;
  v_delivered_at timestamptz;
  v_revision_id uuid;
  v_task_id uuid;
  v_deleted_task_id uuid;
  v_cascade_project_id uuid;
  v_cascade_task_id uuid;
  v_task_completed_at timestamptz;
  v_revision_approved_at timestamptz;
  v_archived_at timestamptz := '2026-02-03T04:05:06Z';
  v_invalid_value text;
  v_invalid_url text;
  v_update_client_definition text;
  v_events int;
begin
  -- O trigger handle_new_user cria o perfil; o rollback final remove usuários, perfis e dados.
  insert into auth.users (id, email)
  values
    (v_owner, 'etapa3-projects-owner-' || v_owner::text || '@example.test'),
    (v_other, 'etapa3-projects-' || v_other::text || '@example.test');

  perform set_config('request.jwt.claim.sub', v_owner::text, true);

  v_update_client_definition := pg_catalog.lower(pg_catalog.pg_get_functiondef(
    'public.update_client(uuid,jsonb)'::pg_catalog.regprocedure
  ));
  if pg_catalog.strpos(v_update_client_definition, ':clients') = 0
    or pg_catalog.strpos(v_update_client_definition, ':clients')
      > pg_catalog.strpos(v_update_client_definition, ':contract:')
    or pg_catalog.strpos(v_update_client_definition, ':contract:') = 0
    or pg_catalog.strpos(v_update_client_definition, ':contract:')
      > pg_catalog.strpos(v_update_client_definition, 'for update') then
    raise exception 'update_client não adquiriu :clients e :contract antes do primeiro row lock.';
  end if;

  if has_table_privilege('anon', 'public.project_tasks', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_table_privilege('anon', 'public.project_revisions', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_function_privilege('anon', 'public.set_project_task_timestamps()', 'EXECUTE')
    or has_function_privilege('anon', 'public.log_project_task_event()', 'EXECUTE')
    or has_function_privilege('anon', 'public.set_project_revision_timestamps()', 'EXECUTE')
    or has_function_privilege('anon', 'public.log_project_revision_event()', 'EXECUTE')
    or has_function_privilege('anon', 'public.enforce_contract_project_allocation()', 'EXECUTE')
    or has_function_privilege('anon', 'public.create_project(jsonb)', 'EXECUTE')
    or has_function_privilege('anon', 'public.update_project(uuid,jsonb)', 'EXECUTE')
    or has_function_privilege('anon', 'public.set_project_status(uuid,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.deliver_project(uuid,jsonb)', 'EXECUTE') then
    raise exception 'anon recebeu privilégio em objetos de projetos.';
  end if;

  v_client := public.create_client(jsonb_build_object(
    'creation_key', gen_random_uuid(), 'name', 'Cliente de projeto',
    'service', 'Site', 'total_value', '1000.00', 'contracted_at', v_today
  ));
  v_client_id := ((v_client ->> 'client')::jsonb ->> 'id')::uuid;
  v_contract_id := ((v_client ->> 'contract')::jsonb ->> 'id')::uuid;

  v_project := public.create_project(jsonb_build_object(
    'client_id', v_client_id,
    'contract_id', v_contract_id, 'name', 'Projeto principal',
    'service', 'Site', 'contracted_value', '600.00',
    'start_date', v_today, 'due_date', v_today + 15,
    'responsible_name', 'Responsável', 'priority', 'high', 'description', 'Teste'
  ));
  v_project_id := (v_project ->> 'id')::uuid;

  v_second := public.create_project(jsonb_build_object(
    'client_id', v_client_id,
    'contract_id', v_contract_id, 'name', 'Projeto complementar',
    'service', 'Conteúdo', 'contracted_value', '400.00',
    'start_date', v_today, 'due_date', v_today + 7,
    'responsible_name', null, 'priority', 'medium', 'description', null
  ));
  v_second_project_id := (v_second ->> 'id')::uuid;

  begin
    perform public.create_project(jsonb_build_object(
      'client_id', v_client_id,
      'contract_id', v_contract_id, 'name', 'Projeto excedente',
      'service', 'Extra', 'contracted_value', '0.01',
      'start_date', v_today, 'due_date', v_today + 7,
      'responsible_name', null, 'priority', 'low', 'description', null
    ));
    raise exception 'Alocação acima do contrato foi aceita.';
  exception when check_violation then
    if sqlerrm <> 'A soma dos projetos excede o valor do contrato.' then raise; end if;
  end;

  foreach v_invalid_value in array array['0.001', '1000000000000.00']::text[] loop
    begin
      perform public.create_project(jsonb_build_object(
        'client_id', v_client_id,
        'contract_id', v_contract_id, 'name', 'Projeto com valor inválido',
        'service', 'Extra', 'contracted_value', v_invalid_value,
        'start_date', v_today, 'due_date', v_today + 7,
        'responsible_name', null, 'priority', 'low', 'description', null
      ));
      raise exception 'create_project aceitou valor inválido: %', v_invalid_value;
    exception when invalid_parameter_value then
      if sqlstate <> '22023' or sqlerrm <> 'Valor alocado inválido.' then raise; end if;
    end;

    begin
      perform public.update_project(v_project_id, jsonb_build_object(
        'client_id', v_client_id,
        'contract_id', v_contract_id, 'name', 'Projeto principal',
        'service', 'Site', 'contracted_value', v_invalid_value,
        'start_date', v_today, 'due_date', v_today + 15,
        'responsible_name', 'Responsável', 'priority', 'high', 'description', 'Teste'
      ));
      raise exception 'update_project aceitou valor inválido: %', v_invalid_value;
    exception when invalid_parameter_value then
      if sqlstate <> '22023' or sqlerrm <> 'Valor alocado inválido.' then raise; end if;
    end;
  end loop;

  if (select contracted_value from public.projects where id = v_project_id) <> 600.00
    or (select count(*) from public.projects where contract_id = v_contract_id) <> 2 then
    raise exception 'Valores inválidos alteraram projetos ou contratos.';
  end if;

  begin
    perform public.update_client(
      v_client_id,
      (v_client ->> 'client')::jsonb || (v_client ->> 'contract')::jsonb || jsonb_build_object(
        'contract_id', v_contract_id, 'name', 'Nome que não deve persistir',
        'service', 'Site', 'total_value', '999.99', 'contracted_at', v_today
      )
    );
    raise exception 'update_client reduziu o total abaixo dos projetos.';
  exception when others then
    if sqlerrm = 'update_client reduziu o total abaixo dos projetos.' then raise; end if;
    if sqlstate <> '23514' or not (
      sqlerrm like 'PROJECT_ALLOCATION_EXCEEDS_CONTRACT:%'
      or sqlerrm like 'CONTRACT_ADJUST_REQUIRED:%'
    ) then raise; end if;
  end;
  if (select name from public.clients where id = v_client_id) <> 'Cliente de projeto'
    or (select total_value from public.contracts where id = v_contract_id) <> 1000.00 then
    raise exception 'A falha de alocação não preservou cliente e contrato.';
  end if;

  -- adjust_contract é implementada e testada no Plano 3; este plano não pressupõe sua existência.

  -- UPDATE privilegiado continua encontrando a validação defensiva da trigger, sem advisory própria.
  begin
    update public.contracts set total_value = '999.99' where id = v_contract_id and owner_id = v_owner;
    raise exception 'Contrato ficou abaixo da alocação não cancelada.';
  exception when check_violation then
    if sqlerrm not like 'PROJECT_ALLOCATION_EXCEEDS_CONTRACT:%' then raise; end if;
  end;

  perform public.set_project_status(v_project_id, 'in_development');
  select count(*) into v_events from public.client_activities
    where project_id = v_project_id and type = 'status_change';
  if v_events <> 1 then
    raise exception 'Mudança de status não gerou um único evento.';
  end if;

  begin
    perform public.set_project_status(v_project_id, 'delivered');
    raise exception 'set_project_status aceitou delivered.';
  exception when check_violation then
    if sqlerrm <> 'Use o fluxo de entrega para marcar o projeto como entregue.' then raise; end if;
  end;
  if exists (
    select 1 from public.client_activities
    where project_id = v_project_id and metadata ->> 'new_status' = 'delivered'
  ) then
    raise exception 'Status direto gerou evento de entrega.';
  end if;

  foreach v_invalid_url in array array[
    'javascript:alert(1)',
    'ftp://example.test/arquivo',
    'https://example.test/com espaco',
    ' https://example.test/entrega'
  ]::text[] loop
    begin
      perform public.deliver_project(v_project_id, jsonb_build_object(
        'delivery_url', v_invalid_url,
        'files_url', 'https://example.test/arquivos-validos', 'confirmed', true
      ));
      raise exception 'deliver_project aceitou delivery_url inválida: %', v_invalid_url;
    exception when invalid_parameter_value then
      if sqlstate <> '22023' or sqlerrm <> 'Informe uma URL HTTP(S) válida.' then raise; end if;
    end;

    begin
      perform public.deliver_project(v_project_id, jsonb_build_object(
        'delivery_url', 'https://example.test/entrega-valida',
        'files_url', v_invalid_url, 'confirmed', true
      ));
      raise exception 'deliver_project aceitou files_url inválida: %', v_invalid_url;
    exception when invalid_parameter_value then
      if sqlstate <> '22023' or sqlerrm <> 'Informe uma URL HTTP(S) válida.' then raise; end if;
    end;
  end loop;

  begin
    perform public.deliver_project(v_project_id, jsonb_build_object(
      'delivery_url', '', 'confirmed', true
    ));
    raise exception 'Entrega sem link foi aceita.';
  exception when invalid_parameter_value then
    if sqlstate <> '22023' or sqlerrm <> 'Informe o link de entrega.' then raise; end if;
  end;

  begin
    perform public.deliver_project(v_project_id, jsonb_build_object(
      'delivery_url', 'https://example.test/entrega-sem-confirmacao', 'confirmed', false
    ));
    raise exception 'Entrega sem confirmação explícita foi aceita.';
  exception when invalid_parameter_value then
    if sqlerrm <> 'Confirme explicitamente a entrega.' then raise; end if;
  end;

  v_delivered := public.deliver_project(v_project_id, jsonb_build_object(
    'delivery_url', 'https://example.test/primeira-entrega',
    'files_url', 'https://example.test/arquivos-originais',
    'final_notes', 'Primeira entrega', 'confirmed', true
  ));
  select delivered_at into v_delivered_at from public.projects where id = v_project_id;
  -- URLs inválidas no payload repetido provam que o retorno idempotente ocorre antes da validação.
  v_repeated := public.deliver_project(v_project_id, jsonb_build_object(
    'delivery_url', 'javascript:alert(1)',
    'files_url', 'ftp://example.test/arquivos-alterados',
    'final_notes', 'Não pode sobrescrever', 'confirmed', false
  ));
  if (v_repeated ->> 'delivery_url') is distinct from 'https://example.test/primeira-entrega'
    or (v_repeated ->> 'files_url') is distinct from 'https://example.test/arquivos-originais'
    or (v_repeated ->> 'final_notes') is distinct from 'Primeira entrega'
    or (v_repeated ->> 'delivered_at')::timestamptz is distinct from v_delivered_at
    or (v_repeated ->> 'delivery_confirmed_at')::timestamptz is null then
    raise exception 'Entrega repetida alterou a primeira entrega confirmada.';
  end if;
  select count(*) into v_events from public.client_activities
    where project_id = v_project_id and type = 'delivery';
  if v_events <> 1 then
    raise exception 'Entrega repetida duplicou o evento.';
  end if;

  -- INSERT direto não pode criar aprovação sem timestamps e histórico.
  insert into public.project_revisions (owner_id, project_id, description, status)
  values (v_owner, v_project_id, 'Revisão aprovada por INSERT', 'approved')
  returning id into v_revision_id;
  if not exists (
    select 1 from public.project_revisions
    where id = v_revision_id and approved_at is not null and completed_at is not null
  ) then
    raise exception 'INSERT approved não recebeu timestamps.';
  end if;
  select count(*) into v_events from public.client_activities
    where project_id = v_project_id and type = 'approval' and metadata ->> 'revision_id' = v_revision_id::text;
  if v_events <> 1 then
    raise exception 'INSERT approved não gerou exatamente um evento de aprovação.';
  end if;

  select approved_at into v_revision_approved_at from public.project_revisions where id = v_revision_id;
  update public.project_revisions set approved_at = '2000-01-01T00:00:00Z' where id = v_revision_id;
  if (select approved_at from public.project_revisions where id = v_revision_id) is distinct from v_revision_approved_at then
    raise exception 'O cliente sobrescreveu approved_at de uma revisão aprovada.';
  end if;
  begin
    update public.project_revisions set status = 'in_progress' where id = v_revision_id;
    raise exception 'Revisão aprovada voltou para outro status.';
  exception when check_violation then
    if sqlerrm <> 'Uma revisão aprovada não pode voltar para outro status.' then raise; end if;
  end;

  do $$
  declare
    v_original_description text;
  begin
    select description into v_original_description from public.project_revisions where id = v_revision_id;
    begin
      update public.project_revisions set description = 'Conteúdo sobrescrito após aprovação'
        where id = v_revision_id;
      raise exception 'Revisão aprovada permitiu alteração de descrição.';
    exception when check_violation then
      if sqlerrm <> 'Uma revisão aprovada não pode ser alterada.' then raise; end if;
    end;
    if (select description from public.project_revisions where id = v_revision_id) is distinct from v_original_description then
      raise exception 'Trigger não bloqueou alteração de descrição de revisão aprovada.';
    end if;
  end;

  do $$
  declare
    v_original_id uuid;
    v_original_requested_at timestamptz;
    v_original_created_at timestamptz;
  begin
    select id, requested_at, created_at into
      v_original_id, v_original_requested_at, v_original_created_at
      from public.project_revisions where id = v_revision_id;
    begin
      update public.project_revisions set id = gen_random_uuid() where id = v_revision_id;
      raise exception 'Revisão aprovada permitiu alteração de id.';
    exception when check_violation then
      if sqlerrm <> 'Uma revisão aprovada não pode ser alterada.' then raise; end if;
    end;
    begin
      update public.project_revisions set requested_at = '2000-01-01T00:00:00Z' where id = v_revision_id;
      raise exception 'Revisão aprovada permitiu alteração de requested_at.';
    exception when check_violation then
      if sqlerrm <> 'Uma revisão aprovada não pode ser alterada.' then raise; end if;
    end;
    begin
      update public.project_revisions set created_at = '2000-01-01T00:00:00Z' where id = v_revision_id;
      raise exception 'Revisão aprovada permitiu alteração de created_at.';
    exception when check_violation then
      if sqlerrm <> 'Uma revisão aprovada não pode ser alterada.' then raise; end if;
    end;
    if exists (
      select 1 from public.project_revisions
      where id = v_revision_id
        and (id is distinct from v_original_id
          or requested_at is distinct from v_original_requested_at
          or created_at is distinct from v_original_created_at)
    ) then
      raise exception 'Trigger não preservou identidade e datas da revisão aprovada.';
    end if;
  end;
  $$;

  insert into public.project_tasks (owner_id, project_id, title, status, completed_at)
  values (v_owner, v_project_id, 'Tarefa concluída pelo banco', 'completed', '2000-01-01T00:00:00Z')
  returning id into v_task_id;
  select completed_at into v_task_completed_at from public.project_tasks where id = v_task_id;
  if v_task_completed_at < now() - interval '1 minute' then
    raise exception 'INSERT completed aceitou completed_at informado pelo cliente.';
  end if;
  update public.project_tasks set completed_at = '2000-01-01T00:00:00Z' where id = v_task_id;
  if (select completed_at from public.project_tasks where id = v_task_id) is distinct from v_task_completed_at then
    raise exception 'O cliente sobrescreveu completed_at de uma tarefa concluída.';
  end if;

  insert into public.project_tasks (owner_id, project_id, title)
  values (v_owner, v_project_id, 'Tarefa excluída diretamente')
  returning id into v_deleted_task_id;
  delete from public.project_tasks where id = v_deleted_task_id and owner_id = v_owner;
  if not found then
    raise exception 'Exclusão direta da tarefa não removeu o registro.';
  end if;
  select count(*) into v_events from public.client_activities
    where project_id = v_project_id and type = 'note'
      and metadata ->> 'task_id' = v_deleted_task_id::text;
  if v_events <> 1 then
    raise exception 'Exclusão direta da tarefa não gerou exatamente um evento.';
  end if;

  -- Projeto cancelado deixa de consumir o total do contrato.
  perform public.set_project_status(v_second_project_id, 'cancelled');
  update public.projects set archived_at = v_archived_at where id = v_second_project_id;
  perform public.set_project_status(v_second_project_id, 'cancelled');
  if (select archived_at from public.projects where id = v_second_project_id) is distinct from v_archived_at then
    raise exception 'Cancelamento repetido sobrescreveu archived_at.';
  end if;

  -- Uma chamada defensiva à RPC não realoca projeto cancelado: preserva 400,00 e registra a decisão.
  perform public.update_project(v_second_project_id, jsonb_build_object(
    'client_id', v_client_id,
    'contract_id', v_contract_id, 'name', 'Projeto complementar',
    'service', 'Conteúdo', 'contracted_value', '999.99',
    'start_date', v_today, 'due_date', v_today + 7,
    'responsible_name', null, 'priority', 'medium', 'description', null
  ));
  if (select contracted_value from public.projects where id = v_second_project_id) <> 400.00
    or (select total_value from public.contracts where id = v_contract_id) <> 1000.00 then
    raise exception 'update_project realocou ou alterou a capacidade de um projeto cancelado.';
  end if;
  select count(*) into v_events from public.client_activities
    where project_id = v_second_project_id and type = 'note'
      and metadata ->> 'contracted_value_preserved' = 'true';
  if v_events <> 1 then
    raise exception 'update_project não registrou a preservação do valor do projeto cancelado.';
  end if;

  update public.contracts set total_value = '600.00' where id = v_contract_id and owner_id = v_owner;
  if (select total_value from public.contracts where id = v_contract_id) <> 600.00 then
    raise exception 'Projeto cancelado continuou bloqueando o saldo do contrato.';
  end if;

  begin
    perform public.set_project_status(v_second_project_id, 'not_started');
    raise exception 'Projeto cancelado voltou sem capacidade no contrato.';
  exception when check_violation then
    if sqlerrm <> 'A soma dos projetos excede o valor do contrato.' then raise; end if;
  end;
  if (select status from public.projects where id = v_second_project_id) <> 'cancelled'
    or (select archived_at from public.projects where id = v_second_project_id) is distinct from v_archived_at then
    raise exception 'Falha ao reativar projeto não preservou status e archived_at.';
  end if;

  update public.contracts set total_value = '1000.00' where id = v_contract_id and owner_id = v_owner;
  perform public.set_project_status(v_second_project_id, 'not_started');
  if (select archived_at from public.projects where id = v_second_project_id) is not null then
    raise exception 'Reativação bem-sucedida não limpou archived_at.';
  end if;

  update public.contracts set status = 'cancelled' where id = v_contract_id and owner_id = v_owner;
  begin
    perform public.update_project(v_project_id, jsonb_build_object(
      'client_id', v_client_id,
      'contract_id', v_contract_id, 'name', 'Nome que não deve persistir',
      'service', 'Site', 'contracted_value', '600.01',
      'start_date', v_today, 'due_date', v_today + 15,
      'responsible_name', 'Responsável', 'priority', 'high', 'description', 'Teste'
    ));
    raise exception 'update_project editou projeto com contrato cancelado.';
  exception when insufficient_privilege then
    if sqlstate <> '42501' or sqlerrm <> 'Contrato cancelado ou inativo não permite edição do projeto.' then raise; end if;
  end;
  if (select name from public.projects where id = v_project_id) <> 'Projeto principal' then
    raise exception 'A falha por contrato cancelado alterou o projeto.';
  end if;
  update public.contracts set status = 'active' where id = v_contract_id and owner_id = v_owner;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  begin
    update public.contracts set total_value = '0.01' where id = v_contract_id;
    raise exception 'UPDATE direto como authenticated foi aceito.';
  exception when insufficient_privilege then
    if sqlstate <> '42501' or sqlerrm not like 'permission denied%' then raise; end if;
  end;
  if (select total_value from public.contracts where id = v_contract_id) <> 1000.00 then
    raise exception 'UPDATE direto autenticado alterou o total do contrato.';
  end if;

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  if exists (select 1 from public.projects where id = v_project_id) then
    raise exception 'RLS permitiu leitura de projeto de outro proprietário.';
  end if;
  if exists (select 1 from public.project_tasks where project_id = v_project_id) then
    raise exception 'RLS permitiu leitura de tarefa de outro proprietário.';
  end if;
  if exists (select 1 from public.project_revisions where project_id = v_project_id) then
    raise exception 'RLS permitiu leitura de revisão de outro proprietário.';
  end if;

  begin
    perform public.update_project(v_project_id, jsonb_build_object(
      'client_id', v_client_id,
      'contract_id', v_contract_id, 'name', 'Alteração cross-owner',
      'service', 'Site', 'contracted_value', '600.00',
      'start_date', v_today, 'due_date', v_today + 15,
      'responsible_name', 'Responsável', 'priority', 'high', 'description', 'Teste'
    ));
    raise exception 'update_project permitiu alteração de projeto de outro proprietário.';
  exception when insufficient_privilege then
    if sqlstate <> '42501' or sqlerrm <> 'Projeto não encontrado ou acesso negado.' then raise; end if;
  end;

  begin
    perform public.create_project(jsonb_build_object(
      'client_id', v_client_id,
      'contract_id', v_contract_id, 'name', 'Criação cross-owner',
      'service', 'Site', 'contracted_value', '0.01',
      'start_date', v_today, 'due_date', v_today + 7,
      'responsible_name', null, 'priority', 'low', 'description', null
    ));
    raise exception 'create_project permitiu uso de contrato de outro proprietário.';
  exception when insufficient_privilege then
    if sqlstate <> '42501' or sqlerrm <> 'Contrato ativo não encontrado para este cliente.' then raise; end if;
  end;

  reset role;

  insert into public.projects (owner_id, client_id, contract_id, name, service, contracted_value)
  values (v_owner, v_client_id, v_contract_id, 'Projeto para cascata', 'Site', 0)
  returning id into v_cascade_project_id;
  insert into public.project_tasks (owner_id, project_id, title)
  values (v_owner, v_cascade_project_id, 'Tarefa removida pela cascata')
  returning id into v_cascade_task_id;
  delete from public.projects where id = v_cascade_project_id and owner_id = v_owner;
  if exists (select 1 from public.project_tasks where id = v_cascade_task_id) then
    raise exception 'Cascata do projeto não removeu a tarefa.';
  end if;
  if exists (
    select 1 from public.client_activities
    where project_id = v_cascade_project_id or metadata ->> 'task_id' = v_cascade_task_id::text
  ) then
    raise exception 'Cascata do projeto tentou criar histórico para uma tarefa sem projeto.';
  end if;

  raise notice 'Contrato SQL de projetos aprovado.';
end
$$;

rollback;
