create extension if not exists dblink;

begin;

do $$
declare
  v_owner uuid;
  v_other uuid := gen_random_uuid();
  v_lead uuid;
  v_second_lead uuid;
  v_cnpj_lead uuid;
  v_invalid_value numeric;
  v_first jsonb;
  v_repeat jsonb;
  v_manual jsonb;
  v_manual_repeat jsonb;
  v_updated jsonb;
  v_invalid_total text;
  v_archived_at timestamptz;
  v_extra_contract_id uuid;
  v_client_count int;
  v_contract_count int;
  v_project_count int;
  v_conversion_count int;
begin
  select id into v_owner from auth.users order by created_at limit 1;
  if v_owner is null then
    raise exception 'Crie ao menos um usuário autenticado antes de executar este teste.';
  end if;

  insert into auth.users (id, email)
  values (v_other, 'etapa3-' || v_other::text || '@example.test');

  insert into public.leads (
    owner_id, name, cnpj, status, source,
    estimated_value, negotiated_value, received_value
  )
  values (
    v_owner, 'Lead de teste transacional', '12.345.678/0001-95', 'negociando', 'teste',
    100.00, 200.00, 50.00
  )
  returning id into v_lead;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_first := public.convert_lead_to_client(
    v_lead, 'Site institucional', 1500.00, current_date,
    'pix', '50% na assinatura', null, 'Site do cliente', current_date, current_date + 14
  );

  v_repeat := public.convert_lead_to_client(
    v_lead, 'Payload diferente', 9999.99, current_date - 1,
    'cartao', 'Outra condição', 'Não sobrescrever', 'Outro projeto', null, null
  );

  if (v_first ->> 'already_existed') is distinct from 'false' then
    raise exception 'A primeira conversão não foi marcada como already_existed=false.';
  end if;
  if (v_first ->> 'client_id') is distinct from (v_repeat ->> 'client_id')
    or (v_first ->> 'link_id') is distinct from (v_repeat ->> 'link_id')
    or (v_first ->> 'contract_id') is distinct from (v_repeat ->> 'contract_id')
    or (v_first ->> 'project_id') is distinct from (v_repeat ->> 'project_id') then
    raise exception 'A repetição da conversão alterou os identificadores.';
  end if;
  if (v_repeat ->> 'already_existed') is distinct from 'true' then
    raise exception 'A repetição não foi marcada como already_existed.';
  end if;

  select count(*) into v_client_count from public.clients where id = (v_first ->> 'client_id')::uuid;
  select count(*) into v_contract_count from public.contracts where source_link_id = (v_first ->> 'link_id')::uuid;
  select count(*) into v_project_count from public.projects where source_link_id = (v_first ->> 'link_id')::uuid;
  select count(*) into v_conversion_count from public.lead_activities
    where lead_id = v_lead and type = 'conversao';

  if v_client_count <> 1 or v_contract_count <> 1 or v_project_count <> 1 or v_conversion_count <> 1 then
    raise exception 'A conversão criou duplicidades ou não registrou a atividade.';
  end if;

  if (select total_value from public.contracts where id = (v_first ->> 'contract_id')::uuid) <> 1500.00 then
    raise exception 'A repetição sobrescreveu o valor do contrato.';
  end if;
  if not exists (
    select 1 from public.leads
    where id = v_lead and owner_id = v_owner
      and status = 'aceitou' and contracted_value = 1500.00
      and estimated_value = 100.00 and negotiated_value = 200.00 and received_value = 50.00
  ) then
    raise exception 'A conversão não preservou o snapshot financeiro esperado do lead.';
  end if;

  insert into public.leads (owner_id, name, cnpj, status)
  values (v_owner, 'Lead adicional com mesmo CNPJ', '12345678000195', 'negociando')
  returning id into v_cnpj_lead;

  v_manual := public.convert_lead_to_client(
    v_cnpj_lead, 'Serviço adicional', 250.00, current_date
  );
  v_manual_repeat := public.convert_lead_to_client(
    v_cnpj_lead, 'Payload diferente', 999.99, current_date - 1,
    'cartao', 'Outra condição', 'Não sobrescrever', 'Projeto indevido', null, null
  );

  if (v_manual ->> 'client_id') is distinct from (v_first ->> 'client_id')
    or (v_manual ->> 'link_id') is not distinct from (v_first ->> 'link_id')
    or (v_manual ->> 'contract_id') is not distinct from (v_first ->> 'contract_id') then
    raise exception 'A conversão por CNPJ não reutilizou somente o cliente esperado.';
  end if;
  if (v_manual ->> 'project_id') is not null
    or (v_manual_repeat ->> 'project_id') is not null then
    raise exception 'A conversão sem projeto criou ou alterou um projeto.';
  end if;
  if (v_manual ->> 'already_existed') is distinct from 'false'
    or (v_manual_repeat ->> 'already_existed') is distinct from 'true'
    or (v_manual_repeat ->> 'link_id') is distinct from (v_manual ->> 'link_id')
    or (v_manual_repeat ->> 'contract_id') is distinct from (v_manual ->> 'contract_id') then
    raise exception 'A repetição da conversão por CNPJ não preservou o vínculo e o contrato.';
  end if;

  select id into v_extra_contract_id from public.contracts
    where source_link_id = (v_manual ->> 'link_id')::uuid;
  select count(*) into v_contract_count from public.contracts
    where source_link_id = (v_manual ->> 'link_id')::uuid;
  select count(*) into v_project_count from public.projects
    where source_link_id = (v_manual ->> 'link_id')::uuid;
  select count(*) into v_conversion_count from public.client_activities
    where client_id = (v_first ->> 'client_id')::uuid and type = 'conversion';

  if v_extra_contract_id is null or v_contract_count <> 1 or v_project_count <> 0
    or v_conversion_count <> 2
    or (select total_value from public.contracts where id = v_extra_contract_id) <> 250.00 then
    raise exception 'A reutilização de CNPJ duplicou registros ou sobrescreveu o payload.';
  end if;

  insert into public.leads (owner_id, name, status)
  values (v_owner, 'Lead para rollback', 'novo')
  returning id into v_second_lead;

  foreach v_invalid_value in array array[0.001::numeric, 1000000000000.00::numeric] loop
    begin
      perform public.convert_lead_to_client(
        v_second_lead, 'Site inválido', v_invalid_value, current_date
      );
      raise exception 'A conversão aceitou valor com escala ou limite inválido.';
    exception when others then
      if sqlerrm = 'A conversão aceitou valor com escala ou limite inválido.' then raise; end if;
      if sqlstate <> '22023' then raise; end if;
    end;
  end loop;

  create function public.test_force_project_failure() returns trigger
  language plpgsql as $test_force_project_failure$ begin raise exception 'FORCE_ROLLBACK'; end; $test_force_project_failure$;
  create trigger test_force_project_failure before insert on public.projects
    for each row execute function public.test_force_project_failure();
  begin
    perform public.convert_lead_to_client(
      v_second_lead, 'Site para rollback', 100.00, current_date,
      null, null, null, 'Projeto para rollback', null, null
    );
    raise exception 'A exceção tardia não foi provocada.';
  exception when others then
    if sqlerrm <> 'FORCE_ROLLBACK' then raise; end if;
  end;
  drop trigger test_force_project_failure on public.projects;
  drop function public.test_force_project_failure();

  if exists (select 1 from public.lead_client_links where lead_id = v_second_lead)
    or exists (select 1 from public.clients where name = 'Lead para rollback')
    or exists (select 1 from public.contracts where service = 'Site para rollback')
    or exists (select 1 from public.projects where name = 'Projeto para rollback')
    or exists (select 1 from public.lead_activities where lead_id = v_second_lead and type = 'conversao')
    or exists (
      select 1 from public.leads
      where id = v_second_lead and owner_id = v_owner
        and (status <> 'novo' or contracted_value <> 0 or received_value <> 0)
    ) then
    raise exception 'A exceção tardia não reverteu cliente, vínculo, contrato, projeto, atividade e snapshot.';
  end if;

  v_manual := public.create_client(jsonb_build_object(
    'creation_key', gen_random_uuid(),
    'name', 'Cliente manual de teste',
    'responsible_name', 'Responsável de teste',
    'phone', '(11) 99999-9999',
    'whatsapp', '',
    'email', 'cliente@example.test',
    'cnpj', '98.765.432/0001-10',
    'website', '',
    'instagram', '',
    'address', '',
    'city', 'São Paulo',
    'district', '',
    'zip_code', '',
    'state', 'SP',
    'niche', 'Teste',
    'status', 'active',
    'notes', '',
    'service', 'Consultoria',
    'total_value', '750.50',
    'contracted_at', current_date,
    'due_date', current_date + 30,
    'payment_method', 'pix',
    'payment_terms', 'À vista',
    'contract_notes', ''
  ));

  v_manual_repeat := public.create_client(jsonb_build_object(
    'creation_key', (v_manual ->> 'client')::jsonb ->> 'creation_key',
    'name', 'Nome diferente',
    'service', 'Serviço diferente',
    'total_value', '9999.99',
    'contracted_at', current_date - 1
  ));

  if ((v_manual ->> 'client')::jsonb ->> 'id') is distinct from ((v_manual_repeat ->> 'client')::jsonb ->> 'id') then
    raise exception 'create_client repetido não retornou o cliente existente.';
  end if;
  if (select name from public.clients where id = ((v_manual ->> 'client')::jsonb ->> 'id')::uuid) <> 'Cliente manual de teste' then
    raise exception 'create_client repetido sobrescreveu o cadastro.';
  end if;
  if (select count(*) from public.contracts where client_id = ((v_manual ->> 'client')::jsonb ->> 'id')::uuid) <> 1 then
    raise exception 'create_client não criou exatamente um contrato inicial.';
  end if;

  foreach v_invalid_total in array array['750.501'::text, '1000000000000.00'::text] loop
    begin
      perform public.create_client(jsonb_build_object(
        'creation_key', gen_random_uuid(), 'name', 'Cliente com valor inválido',
        'service', 'Consultoria', 'total_value', v_invalid_total,
        'contracted_at', current_date
      ));
      raise exception 'create_client aceitou valor com escala ou limite inválido.';
    exception when others then
      if sqlerrm = 'create_client aceitou valor com escala ou limite inválido.' then raise; end if;
      if sqlstate <> '22023' then raise; end if;
    end;
  end loop;
  if exists (select 1 from public.clients where owner_id = v_owner and name = 'Cliente com valor inválido') then
    raise exception 'create_client persistiu cliente com valor inválido.';
  end if;

  begin
    perform public.create_client(jsonb_build_object(
      'creation_key', gen_random_uuid(), 'name', 'Outro cliente',
      'cnpj', '98.765.432/0001-10', 'service', 'Outro serviço',
      'total_value', '10.00', 'contracted_at', current_date
    ));
    raise exception 'create_client aceitou CNPJ duplicado.';
  exception when others then
    if sqlerrm = 'create_client aceitou CNPJ duplicado.' then raise; end if;
    if sqlstate <> '23505' or sqlerrm not like 'CLIENT_CNPJ_DUPLICATE:%' then raise; end if;
  end;

  v_updated := public.update_client(
    ((v_manual ->> 'client')::jsonb ->> 'id')::uuid,
    (v_manual ->> 'client')::jsonb || (v_manual ->> 'contract')::jsonb || jsonb_build_object(
      'contract_id', (v_manual ->> 'contract')::jsonb ->> 'id',
      'name', 'Cliente manual editado', 'service', 'Consultoria editada',
      'total_value', '750.50'
    )
  );
  if (v_updated ->> 'client')::jsonb ->> 'name' <> 'Cliente manual editado'
    or (v_updated ->> 'contract')::jsonb ->> 'service' <> 'Consultoria editada' then
    raise exception 'update_client não atualizou cliente e contrato explicitamente selecionados.';
  end if;

  v_updated := public.update_client(
    (v_first ->> 'client_id')::uuid,
    to_jsonb((select row_to_json(c) from public.clients c where c.id = (v_first ->> 'client_id')::uuid))
      || to_jsonb((select row_to_json(k) from public.contracts k where k.id = (v_first ->> 'contract_id')::uuid))
      || jsonb_build_object(
        'contract_id', v_first ->> 'contract_id', 'name', 'Cliente convertido editado',
        'service', 'Site editado', 'total_value', '1500.00'
      )
  );
  if (select contracted_value from public.leads where id = v_lead) <> 1500.00 then
    raise exception 'Editar cliente convertido alterou o snapshot financeiro do lead.';
  end if;

  begin
    perform public.update_client(
      ((v_manual ->> 'client')::jsonb ->> 'id')::uuid,
      (v_manual ->> 'client')::jsonb || (v_manual ->> 'contract')::jsonb || jsonb_build_object(
        'contract_id', (v_manual ->> 'contract')::jsonb ->> 'id',
        'name', 'Nome que deve ser revertido', 'total_value', '749.99'
      )
    );
    raise exception 'update_client reduziu o total sem ajuste financeiro.';
  exception when others then
    if sqlerrm = 'update_client reduziu o total sem ajuste financeiro.' then raise; end if;
    if sqlstate <> '23514' or sqlerrm not like 'CONTRACT_ADJUST_REQUIRED:%' then raise; end if;
  end;
  if (select name from public.clients where id = ((v_manual ->> 'client')::jsonb ->> 'id')::uuid) <> 'Cliente manual editado' then
    raise exception 'A falha de ajuste não reverteu a edição do cliente.';
  end if;

  foreach v_invalid_total in array array['750.501'::text, '1000000000000.00'::text] loop
    begin
      perform public.update_client(
        ((v_manual ->> 'client')::jsonb ->> 'id')::uuid,
        (v_manual ->> 'client')::jsonb || (v_manual ->> 'contract')::jsonb || jsonb_build_object(
          'contract_id', (v_manual ->> 'contract')::jsonb ->> 'id',
          'name', 'Nome com valor inválido', 'total_value', v_invalid_total
        )
      );
      raise exception 'update_client aceitou valor com escala ou limite inválido.';
    exception when others then
      if sqlerrm = 'update_client aceitou valor com escala ou limite inválido.' then raise; end if;
      if sqlstate <> '22023' then raise; end if;
    end;
  end loop;
  if (select name from public.clients where id = ((v_manual ->> 'client')::jsonb ->> 'id')::uuid) <> 'Cliente manual editado' then
    raise exception 'A falha monetária não reverteu a edição do cliente.';
  end if;

  insert into public.contracts (owner_id, client_id, creation_key, service, total_value, contracted_at)
  values (
    v_owner, ((v_manual ->> 'client')::jsonb ->> 'id')::uuid, gen_random_uuid(),
    'Segundo contrato', 400.00, current_date
  ) returning id into v_extra_contract_id;

  v_updated := public.update_client(
    ((v_manual ->> 'client')::jsonb ->> 'id')::uuid,
    (v_manual ->> 'client')::jsonb || (v_manual ->> 'contract')::jsonb || jsonb_build_object(
      'contract_id', v_extra_contract_id, 'service', 'Segundo contrato editado',
      'total_value', '400.00'
    )
  );
  if (v_updated ->> 'contract')::jsonb ->> 'id' <> v_extra_contract_id::text
    or (select total_value from public.contracts where id = ((v_manual ->> 'contract')::jsonb ->> 'id')::uuid) <> 750.50 then
    raise exception 'update_client alterou o contrato errado em cliente com múltiplos contratos.';
  end if;

  begin
    perform public.update_client(
      ((v_manual ->> 'client')::jsonb ->> 'id')::uuid,
      (v_manual ->> 'client')::jsonb || jsonb_build_object(
        'contract_id', gen_random_uuid(), 'service', 'Site', 'total_value', '750.50',
        'contracted_at', current_date
      )
    );
    raise exception 'update_client aceitou contrato de outro cliente.';
  exception when others then
    if sqlerrm = 'update_client aceitou contrato de outro cliente.' then raise; end if;
    if sqlstate <> '42501' then raise; end if;
  end;

  begin
    perform public.update_client(
      ((v_manual ->> 'client')::jsonb ->> 'id')::uuid,
      (v_manual ->> 'client')::jsonb || (v_manual ->> 'contract')::jsonb || jsonb_build_object(
        'contract_id', (v_manual ->> 'contract')::jsonb ->> 'id',
        'cnpj', '12.345.678/0001-95', 'total_value', '750.50'
      )
    );
    raise exception 'update_client aceitou CNPJ de outro cliente.';
  exception when others then
    if sqlerrm = 'update_client aceitou CNPJ de outro cliente.' then raise; end if;
    if sqlstate <> '23505' or sqlerrm not like 'CLIENT_CNPJ_DUPLICATE:%' then raise; end if;
  end;

  v_updated := public.archive_client(((v_manual ->> 'client')::jsonb ->> 'id')::uuid);
  v_manual_archive := public.archive_client(((v_manual ->> 'client')::jsonb ->> 'id')::uuid);
  if (v_updated ->> 'status') <> 'inactive' or (v_manual_archive ->> 'status') <> 'inactive'
    or (select count(*) from public.client_activities
      where client_id = ((v_manual ->> 'client')::jsonb ->> 'id')::uuid
        and description = 'Cliente arquivado. Contratos e projetos foram preservados.') <> 1
    or (select count(*) from public.contracts where client_id = ((v_manual ->> 'client')::jsonb ->> 'id')::uuid) <> 2 then
    raise exception 'Arquivar repetidamente duplicou evento ou apagou contratos.';
  end if;

  update public.clients set archived_at = '2026-11-20T12:00:00Z'::timestamptz
    where id = ((v_manual ->> 'client')::jsonb ->> 'id')::uuid;
  select archived_at into v_archived_at from public.clients
    where id = ((v_manual ->> 'client')::jsonb ->> 'id')::uuid;
  v_updated := public.update_client(
    ((v_manual ->> 'client')::jsonb ->> 'id')::uuid,
    to_jsonb((select row_to_json(c) from public.clients c where c.id = ((v_manual ->> 'client')::jsonb ->> 'id')::uuid))
      || to_jsonb((select row_to_json(k) from public.contracts k where k.id = ((v_manual ->> 'contract')::jsonb ->> 'id')::uuid))
      || jsonb_build_object(
        'contract_id', (v_manual ->> 'contract')::jsonb ->> 'id',
        'name', 'Cliente arquivado editado', 'status', 'inactive', 'total_value', '750.50'
      )
  );
  if (v_updated ->> 'archived_at')::timestamptz is distinct from v_archived_at then
    raise exception 'Editar cliente inativo alterou a data original de arquivamento.';
  end if;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  begin
    update public.leads set contracted_value = 1.00 where id = v_lead;
    raise exception 'Lead convertido permitiu alterar o valor contratado.';
  exception when others then
    if sqlerrm = 'Lead convertido permitiu alterar o valor contratado.' then raise; end if;
    if sqlstate <> '23514' then raise; end if;
  end;
  begin
    update public.leads set received_value = 1.00 where id = v_lead;
    raise exception 'Lead convertido permitiu alterar o valor recebido.';
  exception when others then
    if sqlerrm = 'Lead convertido permitiu alterar o valor recebido.' then raise; end if;
    if sqlstate <> '23514' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', v_other::text, true);
  if exists (select 1 from public.leads where id = v_lead) then
    raise exception 'RLS permitiu leitura de lead de outro proprietário.';
  end if;
  if exists (select 1 from public.clients where id = (v_first ->> 'client_id')::uuid) then
    raise exception 'RLS permitiu leitura de cliente de outro proprietário.';
  end if;
  if exists (select 1 from public.lead_client_links where id = (v_first ->> 'link_id')::uuid)
    or exists (select 1 from public.contracts where id = (v_first ->> 'contract_id')::uuid)
    or exists (select 1 from public.projects where id = (v_first ->> 'project_id')::uuid)
    or exists (select 1 from public.lead_activities where lead_id = v_lead)
    or exists (select 1 from public.client_activities where client_id = (v_first ->> 'client_id')::uuid) then
    raise exception 'RLS permitiu leitura de vínculo, contrato, projeto ou atividade de outro proprietário.';
  end if;
  begin
    perform public.convert_lead_to_client(
      v_lead, 'Acesso negado', 1.00, current_date
    );
    raise exception 'RPC permitiu converter lead de outro proprietário.';
  exception when others then
    if sqlerrm = 'RPC permitiu converter lead de outro proprietário.' then raise; end if;
    if sqlstate <> '42501' then raise; end if;
  end;
  reset role;

  raise notice 'Contrato SQL de clientes aprovado.';
end
$$;

rollback;

do $$
declare
  v_owner uuid;
  v_lead uuid := gen_random_uuid();
  v_lock_key bigint;
  v_probe_locked boolean := false;
  v_context text;
  v_call text;
  v_cleanup text;
  v_result_a jsonb;
  v_result_b jsonb;
  v_client_count int;
  v_link_count int;
  v_contract_count int;
  v_project_count int;
begin
  select id into v_owner from auth.users order by created_at limit 1;
  if v_owner is null then
    raise exception 'Crie ao menos um usuário autenticado antes de executar o teste paralelo.';
  end if;

  if 'etapa3_convert_admin' = any(dblink_get_connections()) then
    perform dblink_disconnect('etapa3_convert_admin');
  end if;
  if 'etapa3_convert_holder' = any(dblink_get_connections()) then
    perform dblink_disconnect('etapa3_convert_holder');
  end if;
  if 'etapa3_convert_a' = any(dblink_get_connections()) then
    perform dblink_disconnect('etapa3_convert_a');
  end if;
  if 'etapa3_convert_b' = any(dblink_get_connections()) then
    perform dblink_disconnect('etapa3_convert_b');
  end if;

  perform dblink_connect('etapa3_convert_admin', format('dbname=%L user=%L', current_database(), current_user));
  perform dblink_connect('etapa3_convert_holder', format('dbname=%L user=%L', current_database(), current_user));
  perform dblink_connect('etapa3_convert_a', format('dbname=%L user=%L', current_database(), current_user));
  perform dblink_connect('etapa3_convert_b', format('dbname=%L user=%L', current_database(), current_user));

  v_context := format(
    'set role authenticated; do $context$ begin perform set_config(''request.jwt.claim.sub'', %L, false); end $context$;',
    v_owner::text
  );
  perform dblink_exec('etapa3_convert_a', v_context);
  perform dblink_exec('etapa3_convert_b', v_context);
  perform dblink_exec('etapa3_convert_holder', v_context);

  v_cleanup := format(
    'delete from public.client_activities where client_id in (select id from public.clients where creation_key = %L); '
    'delete from public.projects where source_link_id in (select id from public.lead_client_links where lead_id = %L); '
    'delete from public.contracts where source_link_id in (select id from public.lead_client_links where lead_id = %L); '
    'delete from public.lead_activities where lead_id = %L; '
    'delete from public.lead_client_links where lead_id = %L; '
    'delete from public.clients where creation_key = %L; '
    'delete from public.leads where id = %L;',
    v_lead, v_lead, v_lead, v_lead, v_lead, v_lead, v_lead
  );

  perform dblink_exec('etapa3_convert_a', format(
    'insert into public.leads (id, owner_id, name, cnpj, status, source) '
    'values (%L, %L, %L, null, %L, %L);',
    v_lead, v_owner, 'Lead de conversão paralela', 'negociando', 'teste'
  ));

  v_lock_key := pg_catalog.hashtextextended(v_owner::text || ':clients', 0);
  perform dblink_exec('etapa3_convert_holder', format(
    'begin; do $hold_lock$ begin perform pg_catalog.pg_advisory_xact_lock(%s); end $hold_lock$;',
    v_lock_key
  ));

  perform dblink_exec('etapa3_convert_b', format(
    'do $try_lock$ begin '
    'if pg_catalog.pg_try_advisory_xact_lock(%s) then '
    'raise exception ''A segunda sessão adquiriu a advisory :clients.''; '
    'end if; end $try_lock$;',
    v_lock_key
  ));

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  set local lock_timeout = '250ms';
  begin
    perform public.convert_lead_to_client(
      v_lead, 'Site institucional', 1500.00, current_date,
      'pix', '50% na assinatura', null, 'Projeto paralelo', current_date, current_date + 14
    );
  exception
    when lock_not_available then v_probe_locked := true;
    when deadlock_detected then raise exception 'O probe local retornou 40P01 em vez de 55P03.';
  end;
  set local lock_timeout = 0;
  reset role;
  if not v_probe_locked then
    raise exception 'O probe local da conversão não foi bloqueado pela advisory :clients.';
  end if;

  perform dblink_exec('etapa3_convert_holder', format(
    'do $unlock$ begin '
    'if not pg_catalog.pg_advisory_xact_unlock(%s) then '
    'raise exception ''A advisory :clients não foi liberada.''; '
    'end if; end $unlock$;',
    v_lock_key
  ));
  perform dblink_exec('etapa3_convert_holder', 'commit;');

  v_call := format(
    'select public.convert_lead_to_client(%L::uuid, %L, %s, current_date, %L, %L, null, %L, current_date, current_date + 14);',
    v_lead, 'Site institucional', 1500.00,
    'pix', '50% na assinatura', 'Projeto paralelo'
  );
  if dblink_send_query('etapa3_convert_a', v_call) <> 1 then
    raise exception 'Não foi possível enviar a conversão paralela para a sessão A.';
  end if;
  if dblink_send_query('etapa3_convert_b', v_call) <> 1 then
    raise exception 'Não foi possível enviar a conversão paralela para a sessão B.';
  end if;

  begin
    select result into strict v_result_a
    from dblink_get_result('etapa3_convert_a', 'result jsonb') as t(result jsonb);
  exception when deadlock_detected then
    raise exception 'A conversão paralela retornou deadlock 40P01.';
  end;
  begin
    select result into strict v_result_b
    from dblink_get_result('etapa3_convert_b', 'result jsonb') as t(result jsonb);
  exception when deadlock_detected then
    raise exception 'A conversão paralela retornou deadlock 40P01.';
  end;
  if exists (select 1 from dblink_get_result('etapa3_convert_a', 'result jsonb') as t(result jsonb))
    or exists (select 1 from dblink_get_result('etapa3_convert_b', 'result jsonb') as t(result jsonb)) then
    raise exception 'As conversões paralelas deixaram resultados adicionais não consumidos.';
  end if;

  if (v_result_a ->> 'client_id') is distinct from (v_result_b ->> 'client_id')
    or (v_result_a ->> 'link_id') is distinct from (v_result_b ->> 'link_id')
    or (v_result_a ->> 'contract_id') is distinct from (v_result_b ->> 'contract_id')
    or (v_result_a ->> 'project_id') is distinct from (v_result_b ->> 'project_id') then
    raise exception 'As conversões paralelas retornaram identificadores diferentes.';
  end if;
  if not (
    ((v_result_a ->> 'already_existed') is not distinct from 'true'
      and (v_result_b ->> 'already_existed') is not distinct from 'false')
    or ((v_result_a ->> 'already_existed') is not distinct from 'false'
      and (v_result_b ->> 'already_existed') is not distinct from 'true')
  ) then
    raise exception 'As conversões paralelas não marcaram exatamente um already_existed=true.';
  end if;

  select count(*) into v_client_count from public.clients
    where owner_id = v_owner and creation_key = v_lead;
  select count(*) into v_link_count from public.lead_client_links where id = (v_result_a ->> 'link_id')::uuid;
  select count(*) into v_contract_count from public.contracts where source_link_id = (v_result_a ->> 'link_id')::uuid;
  select count(*) into v_project_count from public.projects where source_link_id = (v_result_a ->> 'link_id')::uuid;
  if v_client_count <> 1 or v_link_count <> 1 or v_contract_count <> 1 or v_project_count <> 1 then
    raise exception 'A conversão paralela duplicou cliente, vínculo, contrato ou projeto.';
  end if;

  perform dblink_exec('etapa3_convert_admin', v_cleanup);
  perform dblink_disconnect('etapa3_convert_a');
  perform dblink_disconnect('etapa3_convert_b');
  perform dblink_disconnect('etapa3_convert_holder');
  perform dblink_disconnect('etapa3_convert_admin');
  raise notice 'Harness de conversão paralela aprovado sem 40P01.';
exception
  when others then
    begin
      reset role;
      set local lock_timeout = 0;
    exception when others then
      raise notice 'Falha ao restaurar o contexto local: % (%).', sqlerrm, sqlstate;
    end;
    begin
      if 'etapa3_convert_holder' = any(dblink_get_connections()) then
        perform dblink_disconnect('etapa3_convert_holder');
      end if;
    exception when others then
      raise notice 'Falha ao desconectar etapa3_convert_holder: % (%).', sqlerrm, sqlstate;
    end;
    begin
      if 'etapa3_convert_a' = any(dblink_get_connections()) then
        perform dblink_disconnect('etapa3_convert_a');
      end if;
    exception when others then
      raise notice 'Falha ao desconectar etapa3_convert_a: % (%).', sqlerrm, sqlstate;
    end;
    begin
      if 'etapa3_convert_b' = any(dblink_get_connections()) then
        perform dblink_disconnect('etapa3_convert_b');
      end if;
    exception when others then
      raise notice 'Falha ao desconectar etapa3_convert_b: % (%).', sqlerrm, sqlstate;
    end;
    begin
      if 'etapa3_convert_admin' = any(dblink_get_connections()) then
        perform dblink_disconnect('etapa3_convert_admin');
      end if;
      perform dblink_connect('etapa3_convert_admin', format('dbname=%L user=%L', current_database(), current_user));
      perform dblink_exec('etapa3_convert_admin', v_cleanup);
    exception when others then
      raise notice 'Falha ao limpar a fixture de conversão paralela: % (%). O erro original será preservado.', sqlerrm, sqlstate;
    end;
    begin
      if 'etapa3_convert_admin' = any(dblink_get_connections()) then
        perform dblink_disconnect('etapa3_convert_admin');
      end if;
    exception when others then
      raise notice 'Falha ao desconectar etapa3_convert_admin: % (%).', sqlerrm, sqlstate;
    end;
    raise;
end
$$;

do $$
declare
  v_owner uuid;
  v_key uuid := gen_random_uuid();
  v_lock_key bigint;
  v_probe_locked boolean := false;
  v_context text;
  v_payload jsonb;
  v_call text;
  v_cleanup text;
  v_result_a jsonb;
  v_result_b jsonb;
  v_client_count int;
  v_contract_count int;
begin
  select id into v_owner from auth.users order by created_at limit 1;
  if v_owner is null then
    raise exception 'Crie ao menos um usuário autenticado antes de executar o teste paralelo.';
  end if;

  if 'etapa3_create_admin' = any(dblink_get_connections()) then
    perform dblink_disconnect('etapa3_create_admin');
  end if;
  if 'etapa3_create_holder' = any(dblink_get_connections()) then
    perform dblink_disconnect('etapa3_create_holder');
  end if;
  if 'etapa3_create_a' = any(dblink_get_connections()) then
    perform dblink_disconnect('etapa3_create_a');
  end if;
  if 'etapa3_create_b' = any(dblink_get_connections()) then
    perform dblink_disconnect('etapa3_create_b');
  end if;

  perform dblink_connect('etapa3_create_admin', format('dbname=%L user=%L', current_database(), current_user));
  perform dblink_connect('etapa3_create_holder', format('dbname=%L user=%L', current_database(), current_user));
  perform dblink_connect('etapa3_create_a', format('dbname=%L user=%L', current_database(), current_user));
  perform dblink_connect('etapa3_create_b', format('dbname=%L user=%L', current_database(), current_user));

  v_context := format(
    'set role authenticated; do $context$ begin perform set_config(''request.jwt.claim.sub'', %L, false); end $context$;',
    v_owner::text
  );
  perform dblink_exec('etapa3_create_a', v_context);
  perform dblink_exec('etapa3_create_b', v_context);
  perform dblink_exec('etapa3_create_holder', v_context);

  v_payload := jsonb_build_object(
    'creation_key', v_key,
    'name', 'Cliente de criação paralela',
    'service', 'Consultoria',
    'total_value', '750.50',
    'contracted_at', current_date
  );
  v_cleanup := format(
    'delete from public.client_activities where client_id in (select id from public.clients where creation_key = %L); '
    'delete from public.contracts where creation_key = %L; '
    'delete from public.clients where creation_key = %L;',
    v_key, v_key, v_key
  );

  v_lock_key := pg_catalog.hashtextextended(v_owner::text || ':clients', 0);
  perform dblink_exec('etapa3_create_holder', format(
    'begin; do $hold_lock$ begin perform pg_catalog.pg_advisory_xact_lock(%s); end $hold_lock$;',
    v_lock_key
  ));

  perform dblink_exec('etapa3_create_b', format(
    'do $try_lock$ begin '
    'if pg_catalog.pg_try_advisory_xact_lock(%s) then '
    'raise exception ''A segunda sessão adquiriu a advisory :clients.''; '
    'end if; end $try_lock$;',
    v_lock_key
  ));

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  set local lock_timeout = '250ms';
  begin
    perform public.create_client(v_payload);
  exception
    when lock_not_available then v_probe_locked := true;
    when deadlock_detected then raise exception 'O probe local retornou 40P01 em vez de 55P03.';
  end;
  set local lock_timeout = 0;
  reset role;
  if not v_probe_locked then
    raise exception 'O probe local de create_client não foi bloqueado pela advisory :clients.';
  end if;

  perform dblink_exec('etapa3_create_holder', format(
    'do $unlock$ begin '
    'if not pg_catalog.pg_advisory_xact_unlock(%s) then '
    'raise exception ''A advisory :clients não foi liberada.''; '
    'end if; end $unlock$;',
    v_lock_key
  ));
  perform dblink_exec('etapa3_create_holder', 'commit;');

  v_call := format('select public.create_client(%L::jsonb);', v_payload::text);
  if dblink_send_query('etapa3_create_a', v_call) <> 1 then
    raise exception 'Não foi possível enviar a criação paralela para a sessão A.';
  end if;
  if dblink_send_query('etapa3_create_b', v_call) <> 1 then
    raise exception 'Não foi possível enviar a criação paralela para a sessão B.';
  end if;

  begin
    select result into strict v_result_a
    from dblink_get_result('etapa3_create_a', 'result jsonb') as t(result jsonb);
  exception when deadlock_detected then
    raise exception 'A criação paralela retornou deadlock 40P01.';
  end;
  begin
    select result into strict v_result_b
    from dblink_get_result('etapa3_create_b', 'result jsonb') as t(result jsonb);
  exception when deadlock_detected then
    raise exception 'A criação paralela retornou deadlock 40P01.';
  end;
  if exists (select 1 from dblink_get_result('etapa3_create_a', 'result jsonb') as t(result jsonb))
    or exists (select 1 from dblink_get_result('etapa3_create_b', 'result jsonb') as t(result jsonb)) then
    raise exception 'As criações paralelas deixaram resultados adicionais não consumidos.';
  end if;

  if (v_result_a -> 'client' ->> 'id') is distinct from (v_result_b -> 'client' ->> 'id')
    or (v_result_a -> 'contract' ->> 'id') is distinct from (v_result_b -> 'contract' ->> 'id') then
    raise exception 'As criações paralelas retornaram identificadores diferentes.';
  end if;
  if not (
    ((v_result_a ->> 'already_existed') is not distinct from 'true'
      and (v_result_b ->> 'already_existed') is not distinct from 'false')
    or ((v_result_a ->> 'already_existed') is not distinct from 'false'
      and (v_result_b ->> 'already_existed') is not distinct from 'true')
  ) then
    raise exception 'As criações paralelas não marcaram exatamente um already_existed=true.';
  end if;

  select count(*) into v_client_count from public.clients where creation_key = v_key;
  select count(*) into v_contract_count from public.contracts where creation_key = v_key;
  if v_client_count <> 1 or v_contract_count <> 1 then
    raise exception 'A criação paralela duplicou cliente ou contrato.';
  end if;

  perform dblink_exec('etapa3_create_admin', v_cleanup);
  perform dblink_disconnect('etapa3_create_a');
  perform dblink_disconnect('etapa3_create_b');
  perform dblink_disconnect('etapa3_create_holder');
  perform dblink_disconnect('etapa3_create_admin');
  raise notice 'Harness de criação paralela aprovado sem 40P01.';
exception
  when others then
    begin
      reset role;
      set local lock_timeout = 0;
    exception when others then
      raise notice 'Falha ao restaurar o contexto local: % (%).', sqlerrm, sqlstate;
    end;
    begin
      if 'etapa3_create_holder' = any(dblink_get_connections()) then
        perform dblink_disconnect('etapa3_create_holder');
      end if;
    exception when others then
      raise notice 'Falha ao desconectar etapa3_create_holder: % (%).', sqlerrm, sqlstate;
    end;
    begin
      if 'etapa3_create_a' = any(dblink_get_connections()) then
        perform dblink_disconnect('etapa3_create_a');
      end if;
    exception when others then
      raise notice 'Falha ao desconectar etapa3_create_a: % (%).', sqlerrm, sqlstate;
    end;
    begin
      if 'etapa3_create_b' = any(dblink_get_connections()) then
        perform dblink_disconnect('etapa3_create_b');
      end if;
    exception when others then
      raise notice 'Falha ao desconectar etapa3_create_b: % (%).', sqlerrm, sqlstate;
    end;
    begin
      if 'etapa3_create_admin' = any(dblink_get_connections()) then
        perform dblink_disconnect('etapa3_create_admin');
      end if;
      perform dblink_connect('etapa3_create_admin', format('dbname=%L user=%L', current_database(), current_user));
      perform dblink_exec('etapa3_create_admin', v_cleanup);
    exception when others then
      raise notice 'Falha ao limpar a fixture de criação paralela: % (%). O erro original será preservado.', sqlerrm, sqlstate;
    end;
    begin
      if 'etapa3_create_admin' = any(dblink_get_connections()) then
        perform dblink_disconnect('etapa3_create_admin');
      end if;
    exception when others then
      raise notice 'Falha ao desconectar etapa3_create_admin: % (%).', sqlerrm, sqlstate;
    end;
    raise;
end
$$;
