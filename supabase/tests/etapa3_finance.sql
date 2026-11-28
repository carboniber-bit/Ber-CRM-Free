-- supabase/tests/etapa3_finance.sql
begin;

do $$
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values
    (
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'finance-owner@example.test', '', now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Financeiro Owner"}'::jsonb, now(), now()
    ),
    (
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'finance-other@example.test', '', now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Financeiro Other"}'::jsonb, now(), now()
    )
  on conflict (id) do nothing;
end
$$;

do $$
declare
  v_owner uuid;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_client jsonb;
  v_contract jsonb;
  v_contract_id uuid;
  v_repeat jsonb;
  v_project_contract_id uuid;
  v_empty_contract_id uuid;
  v_empty_installments jsonb;
  v_invalid_amount text;
  v_sum numeric;
  v_last_amount numeric;
  v_state text;
begin
  select id into v_owner from auth.users where id = '00000000-0000-4000-8000-000000000001';
  if v_owner is null then raise exception 'Fixture sintética do proprietário financeiro não foi criada.'; end if;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  set local role authenticated;

  v_client := public.create_client(jsonb_build_object(
    'creation_key', gen_random_uuid(),
    'name', 'Cliente financeiro',
    'service', 'Site',
    'total_value', '1000.00',
    'contracted_at', v_today
  ));

  v_contract := public.create_contract(jsonb_build_object(
    'creation_key', gen_random_uuid(),
    'client_id', (v_client ->> 'client')::jsonb ->> 'id',
    'service', 'Consultoria',
    'total_value', '1000.00',
    'contracted_at', v_today,
    'due_date', v_today + 30,
    'payment_method', 'pix',
    'payment_terms', 'À vista',
    'notes', null
  ));
  v_contract_id := (v_contract ->> 'id')::uuid;

  if not has_table_privilege('authenticated', 'public.contracts', 'SELECT')
    or has_table_privilege('authenticated', 'public.contracts', 'UPDATE')
    or has_table_privilege('authenticated', 'public.contracts', 'INSERT')
    or has_table_privilege('authenticated', 'public.contracts', 'DELETE') then
    raise exception 'Privilégios de contracts não estão restritos a SELECT.';
  end if;
  begin
    update public.contracts
      set total_value = 1.00
      where id = v_contract_id and owner_id = v_owner;
    raise exception 'UPDATE direto em contracts.total_value foi aceito.';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '42501' then raise; end if;
  end;
  select total_value into v_sum from public.contracts where id = v_contract_id;
  if v_sum <> 1000.00 then raise exception 'UPDATE negado alterou o total do contrato.'; end if;

  v_repeat := public.create_contract(jsonb_build_object(
    'creation_key', v_contract ->> 'creation_key',
    'client_id', (v_client ->> 'client')::jsonb ->> 'id',
    'service', 'Outro serviço',
    'total_value', '9999.00',
    'contracted_at', v_today - 1
  ));
  if (v_contract ->> 'id') is distinct from (v_repeat ->> 'id') then
    raise exception 'create_contract repetido alterou o contrato.';
  end if;

  perform public.replace_contract_installments(v_contract_id, jsonb_build_array(
    jsonb_build_object('amount', '600.00', 'due_date', v_today + 7, 'notes', null),
    jsonb_build_object('amount', '400.00', 'due_date', v_today + 30, 'notes', null)
  ));
  select sum(amount) into v_sum
    from public.contract_installments
    where contract_id = v_contract_id;
  if v_sum <> 1000.00 then raise exception 'Soma das parcelas difere do contrato.'; end if;

  perform public.adjust_contract(v_contract_id, 900.00);
  select amount into v_last_amount
    from public.contract_installments
    where contract_id = v_contract_id
    order by position desc
    limit 1;
  if v_last_amount <> 300.00 then raise exception 'Ajuste não reduziu a última parcela corretamente.'; end if;

  v_project_contract_id := (public.create_contract(jsonb_build_object(
    'creation_key', gen_random_uuid(),
    'client_id', (v_client ->> 'client')::jsonb ->> 'id',
    'service', 'Projeto reservado',
    'total_value', '1000.00',
    'contracted_at', v_today,
    'due_date', v_today + 30
  )) ->> 'id')::uuid;
  perform public.create_project(jsonb_build_object(
    'client_id', (v_client ->> 'client')::jsonb ->> 'id',
    'contract_id', v_project_contract_id,
    'name', 'Projeto com valor alocado',
    'service', 'Site',
    'contracted_value', '800.00',
    'description', null,
    'start_date', v_today,
    'due_date', v_today + 7,
    'responsible_name', null,
    'priority', 'medium'
  ));

  begin
    perform public.adjust_contract(v_project_contract_id, 700.00);
    raise exception 'Total abaixo dos projetos foi aceito.';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '23514'
      or sqlerrm not like 'PROJECT_ALLOCATION_EXCEEDS_CONTRACT:%' then
      raise;
    end if;
  end;

  v_empty_contract_id := (public.create_contract(jsonb_build_object(
    'creation_key', gen_random_uuid(),
    'client_id', (v_client ->> 'client')::jsonb ->> 'id',
    'service', 'Contrato sem parcelas',
    'total_value', '250.00',
    'contracted_at', v_today,
    'due_date', v_today + 45
  )) ->> 'id')::uuid;
  perform public.replace_contract_installments(v_empty_contract_id, jsonb_build_array(
    jsonb_build_object('amount', '250.00', 'due_date', v_today + 45, 'notes', null)
  ));
  v_empty_installments := public.replace_contract_installments(v_empty_contract_id, '[]'::jsonb);
  if jsonb_array_length(v_empty_installments) <> 0
    or exists (
      select 1 from public.contract_installments
      where contract_id = v_empty_contract_id and owner_id = v_owner
    ) then
    raise exception 'Array vazio não removeu todas as parcelas.';
  end if;

  foreach v_invalid_amount in array array[
    'abc', '1e3', 'NaN', 'Infinity', '1.234', '1000000000000.00'
  ] loop
    begin
      perform public.replace_contract_installments(v_empty_contract_id, jsonb_build_array(
        jsonb_build_object('amount', v_invalid_amount, 'due_date', v_today + 45, 'notes', null)
      ));
      raise exception 'Parcela com amount textual inválido foi aceita: %.', v_invalid_amount;
    exception when others then
      if sqlerrm like 'Parcela com amount textual inválido foi aceita:%' then raise; end if;
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state <> '22023'
        or sqlerrm <> 'Cada parcela exige valor positivo com duas casas e vencimento.' then
        raise;
      end if;
    end;
  end loop;
  if exists (
    select 1 from public.contract_installments
    where contract_id = v_empty_contract_id and owner_id = v_owner
  ) then
    raise exception 'Uma parcela inválida persistiu após a validação textual.';
  end if;

  reset role;
  raise notice 'Contrato SQL de contratos, parcelas e validação textual aprovado.';
end
$$;

rollback;
