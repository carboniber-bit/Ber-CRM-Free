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

  insert into public.leads (owner_id, name, cnpj, status, source)
  values (v_owner, 'Lead de teste transacional', '12.345.678/0001-95', 'negociando', 'teste')
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
  v_try_lock boolean;
  v_probe_locked boolean := false;
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
    'set local role authenticated; set_config(''request.jwt.claim.sub'', %L, true); '
    'insert into public.leads (id, owner_id, name, cnpj, status, source) '
    'values (%L, %L, %L, null, %L, %L);',
    v_owner::text, v_lead, v_owner, 'Lead de conversão paralela', 'negociando', 'teste'
  ));

  v_lock_key := pg_catalog.hashtextextended(v_owner::text || ':clients', 0);
  perform dblink_exec('etapa3_convert_holder', format(
    'begin; set local role authenticated; set_config(''request.jwt.claim.sub'', %L, true); '
    'select pg_catalog.pg_advisory_xact_lock(%s);',
    v_owner::text, v_lock_key
  ));

  perform dblink_send_query('etapa3_convert_b', format(
    'set local role authenticated; set_config(''request.jwt.claim.sub'', %L, true); '
    'select pg_catalog.pg_try_advisory_xact_lock(%s);',
    v_owner::text, v_lock_key
  ));
  v_try_lock := dblink_get_result('etapa3_convert_b')::boolean;
  if v_try_lock is distinct from false then
    raise exception 'A segunda sessão não confirmou o conflito da advisory :clients.';
  end if;

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

  perform dblink_send_query('etapa3_convert_holder', format(
    'set local role authenticated; set_config(''request.jwt.claim.sub'', %L, true); '
    'select pg_catalog.pg_advisory_xact_unlock(%s);',
    v_owner::text, v_lock_key
  ));
  if dblink_get_result('etapa3_convert_holder')::boolean is not true then
    raise exception 'A advisory :clients não foi liberada antes das chamadas paralelas.';
  end if;
  perform dblink_exec('etapa3_convert_holder', 'commit;');

  v_call := format(
    'set local role authenticated; set_config(''request.jwt.claim.sub'', %L, true); '
    'select public.convert_lead_to_client(%L::uuid, %L, %s, current_date, %L, %L, null, %L, current_date, current_date + 14);',
    v_owner::text, v_lead, 'Site institucional', 1500.00,
    'pix', '50% na assinatura', 'Projeto paralelo'
  );
  perform dblink_send_query('etapa3_convert_a', v_call);
  perform dblink_send_query('etapa3_convert_b', v_call);

  begin
    v_result_a := dblink_get_result('etapa3_convert_a')::jsonb;
  exception when deadlock_detected then
    raise exception 'A conversão paralela retornou deadlock 40P01.';
  end;
  begin
    v_result_b := dblink_get_result('etapa3_convert_b')::jsonb;
  exception when deadlock_detected then
    raise exception 'A conversão paralela retornou deadlock 40P01.';
  end;

  if (v_result_a ->> 'client_id') is distinct from (v_result_b ->> 'client_id')
    or (v_result_a ->> 'link_id') is distinct from (v_result_b ->> 'link_id')
    or (v_result_a ->> 'contract_id') is distinct from (v_result_b ->> 'contract_id')
    or (v_result_a ->> 'project_id') is distinct from (v_result_b ->> 'project_id') then
    raise exception 'As conversões paralelas retornaram identificadores diferentes.';
  end if;
  if (v_result_a ->> 'already_existed') not in ('true', 'false')
    or (v_result_b ->> 'already_existed') not in ('true', 'false')
    or ((v_result_a ->> 'already_existed')::boolean) = ((v_result_b ->> 'already_existed')::boolean) then
    raise exception 'As conversões paralelas não marcaram exatamente um already_existed=true.';
  end if;

  select count(*) into v_client_count from public.clients where id = (v_result_a ->> 'client_id')::uuid;
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
