create extension if not exists dblink;

do $$
declare
  v_conn_a text := 'task_concurrency_a_' || gen_random_uuid()::text;
  v_conn_b text := 'task_concurrency_b_' || gen_random_uuid()::text;
  v_owner uuid := gen_random_uuid();
  v_today date := DATE '2026-02-01';
  v_client_id uuid;
  v_project_id uuid;
  v_task_ids uuid[];
  v_order uuid[];
  v_result text;
  v_cleanup_sql text;
  v_setup_committed boolean := false;
  v_state text;
  v_operation text;
  v_direction int;
  v_direct_sql text;
  v_reorder_sql text;
begin
  perform dblink_connect(v_conn_a, format('dbname=%L user=%L', current_database(), current_user));
  perform dblink_connect(v_conn_b, format('dbname=%L user=%L', current_database(), current_user));

  begin
    perform dblink_exec(v_conn_a, 'begin');
    perform dblink_exec(v_conn_a, format(
      'insert into auth.users (id, email) values (%L::uuid, %L)',
      v_owner::text, 'etapa3-task-concurrency-' || v_owner::text || '@example.test'
    ));
    perform dblink_exec(v_conn_a, 'set local role authenticated');
    perform dblink_exec(v_conn_a, format('select set_config(''request.jwt.claim.sub'', %L, true)', v_owner::text));
    select dblink_eval(v_conn_a, format(
      'select public.create_client(%L::jsonb)',
      jsonb_build_object(
        'creation_key', gen_random_uuid(), 'name', 'Cliente de concorrência de tarefas',
        'service', 'Site', 'total_value', '0.00', 'contracted_at', v_today
      )::text
    )) into v_result;
    v_client_id := ((v_result::jsonb ->> 'client')::jsonb ->> 'id')::uuid;
    select dblink_eval(v_conn_a, format(
      'select public.create_project(%L::jsonb)',
      jsonb_build_object(
        'client_id', v_client_id,
        'contract_id', ((v_result::jsonb ->> 'contract')::jsonb ->> 'id')::uuid,
        'name', 'Projeto de concorrência de tarefas', 'service', 'Site', 'contracted_value', '0.00'
      )::text
    )) into v_result;
    v_project_id := (v_result::jsonb ->> 'id')::uuid;
    select dblink_eval(v_conn_a, format($fixture$
      select array_agg(id order by title) from (
        insert into public.project_tasks (owner_id, project_id, title)
        values (%1$L::uuid, %2$L::uuid, 'A'), (%1$L::uuid, %2$L::uuid, 'B')
        returning id, title
      ) as inserted
    $fixture$, v_owner::text, v_project_id::text)) into v_result;
    v_task_ids := v_result::uuid[];
    v_order := array[v_task_ids[2], v_task_ids[1]];

    -- O rollback remoto desfaz SET LOCAL ROLE authenticated. O cleanup garante o papel
    -- privilegiado da conexão, restaura a claim e nunca exclui dados como authenticated.
    v_cleanup_sql := format($cleanup$
      begin;
      reset role;
      select set_config('request.jwt.claim.sub', %3$L, true);
      delete from public.project_revisions where project_id = %1$L::uuid;
      delete from public.project_tasks where project_id = %1$L::uuid;
      delete from public.client_activities where client_id = %2$L::uuid;
      delete from public.projects where id = %1$L::uuid;
      delete from public.contracts where client_id = %2$L::uuid;
      delete from public.clients where id = %2$L::uuid;
      delete from auth.users where id = %3$L::uuid;
      commit;
    $cleanup$, v_project_id::text, v_client_id::text, v_owner::text);
    perform dblink_exec(v_conn_a, 'commit');
    v_setup_committed := true;

    v_reorder_sql := format(
      'select public.reorder_project_tasks(%L::uuid, %L::uuid[])', v_project_id::text, v_order::text
    );
    foreach v_operation in array array['insert', 'update', 'delete'] loop
      v_direct_sql := case v_operation
        when 'insert' then format(
          'insert into public.project_tasks (owner_id, project_id, title) values (%L::uuid, %L::uuid, %L)',
          v_owner::text, v_project_id::text, 'Probe INSERT'
        )
        when 'update' then format(
          'update public.project_tasks set notes = %L where id = %L::uuid',
          'Probe UPDATE', v_task_ids[1]::text
        )
        else format(
          'delete from public.project_tasks where id = %L::uuid', v_task_ids[1]::text
        )
      end;

      -- Direção 1: escrita direta na A bloqueia a reordenação na B.
      -- Direção 2: reordenação na A bloqueia a mesma escrita direta na B.
      for v_direction in 1..2 loop
        perform dblink_exec(v_conn_a, 'begin');
        perform dblink_exec(v_conn_a, 'set local role authenticated');
        perform dblink_exec(v_conn_a, format('select set_config(''request.jwt.claim.sub'', %L, true)', v_owner::text));
        if v_direction = 1 then
          perform dblink_exec(v_conn_a, v_direct_sql);
        else
          perform dblink_exec(v_conn_a, v_reorder_sql);
        end if;

        perform dblink_exec(v_conn_b, 'begin');
        perform dblink_exec(v_conn_b, 'set local role authenticated');
        perform dblink_exec(v_conn_b, format('select set_config(''request.jwt.claim.sub'', %L, true)', v_owner::text));
        perform dblink_exec(v_conn_b, 'set local lock_timeout = ''1s''');
        select dblink_eval(v_conn_b, format(
          'select pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(%L || '':project_tasks'', 0))', v_owner::text
        )) into v_result;
        if v_result <> 'f' then
          raise exception 'A advisory de tarefas não foi confirmada no probe %/% na conexão B.',
            v_operation, v_direction;
        end if;

        begin
          if v_direction = 1 then
            perform dblink_exec(v_conn_b, v_reorder_sql);
          else
            perform dblink_exec(v_conn_b, v_direct_sql);
          end if;
          raise exception 'Probe %/% ignorou a advisory de tarefas.', v_operation, v_direction;
        exception when others then
          get stacked diagnostics v_state = returned_sqlstate;
          if v_state <> '55P03' then raise; end if;
        end;
        perform dblink_exec(v_conn_b, 'rollback');
        perform dblink_exec(v_conn_a, 'rollback');
      end loop;
    end loop;
  exception when others then
    if v_conn_a = any(dblink_get_connections()) then
      begin perform dblink_exec(v_conn_a, 'rollback'); exception when others then raise notice 'Falha no rollback A: %', sqlerrm; end;
      if v_setup_committed and v_cleanup_sql is not null then
        begin perform dblink_exec(v_conn_a, v_cleanup_sql); exception when others then raise notice 'Falha no cleanup A: %', sqlerrm; end;
      end if;
      begin perform dblink_disconnect(v_conn_a); exception when others then raise notice 'Falha no disconnect A: %', sqlerrm; end;
    end if;
    if v_conn_b = any(dblink_get_connections()) then
      begin perform dblink_exec(v_conn_b, 'rollback'); exception when others then raise notice 'Falha no rollback B: %', sqlerrm; end;
      begin perform dblink_disconnect(v_conn_b); exception when others then raise notice 'Falha no disconnect B: %', sqlerrm; end;
    end if;
    raise;
  end;

  if v_conn_a = any(dblink_get_connections()) then
    perform dblink_exec(v_conn_a, 'rollback');
    if v_setup_committed and v_cleanup_sql is not null then perform dblink_exec(v_conn_a, v_cleanup_sql); end if;
    perform dblink_disconnect(v_conn_a);
  end if;
  if v_conn_b = any(dblink_get_connections()) then
    perform dblink_exec(v_conn_b, 'rollback');
    perform dblink_disconnect(v_conn_b);
  end if;
  raise notice 'Concorrência de INSERT, UPDATE e DELETE diretos com reordenação aprovada nas duas direções.';
end
$$;
