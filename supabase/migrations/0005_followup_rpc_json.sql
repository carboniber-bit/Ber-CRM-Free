begin;

drop function if exists public.create_lead_followup(uuid, timestamp with time zone, text, text);
drop function if exists public.complete_lead_followup(uuid, text);
drop function if exists public.cancel_lead_followup(uuid);

create function public.create_lead_followup(
  p_lead_id uuid,
  p_due_at timestamp with time zone,
  p_reason text default null,
  p_note text default null
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_followup public.lead_followups;
begin
  if p_due_at <= now() then
    raise exception 'A data do próximo contato deve ser futura.' using errcode = '22023';
  end if;

  perform 1 from public.leads where id = p_lead_id for update;
  if not found then
    raise exception 'Lead não encontrado ou acesso negado.' using errcode = '42501';
  end if;

  insert into public.lead_followups (lead_id, due_at, reason, note)
  values (p_lead_id, p_due_at, p_reason, p_note)
  returning * into v_followup;

  return to_jsonb(v_followup);
end;
$$;

create function public.complete_lead_followup(
  p_followup_id uuid,
  p_result text default null
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_lead_id uuid;
  v_followup public.lead_followups;
begin
  select followup.lead_id into v_lead_id
  from public.lead_followups as followup
  where followup.id = p_followup_id
    and followup.status = 'pendente';

  if not found then
    return null;
  end if;

  perform 1 from public.leads where id = v_lead_id for update;
  if not found then
    return null;
  end if;

  update public.lead_followups
  set status = 'concluido', completed_at = now(), result = p_result
  where id = p_followup_id
    and status = 'pendente'
  returning * into v_followup;

  if not found then
    return null;
  end if;

  return to_jsonb(v_followup);
end;
$$;

create function public.cancel_lead_followup(p_followup_id uuid)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_lead_id uuid;
  v_followup public.lead_followups;
begin
  select followup.lead_id into v_lead_id
  from public.lead_followups as followup
  where followup.id = p_followup_id
    and followup.status = 'pendente';

  if not found then
    return null;
  end if;

  perform 1 from public.leads where id = v_lead_id for update;
  if not found then
    return null;
  end if;

  update public.lead_followups
  set status = 'cancelado'
  where id = p_followup_id
    and status = 'pendente'
  returning * into v_followup;

  if not found then
    return null;
  end if;

  return to_jsonb(v_followup);
end;
$$;

revoke all on function public.create_lead_followup(uuid, timestamp with time zone, text, text) from public;
revoke all on function public.complete_lead_followup(uuid, text) from public;
revoke all on function public.cancel_lead_followup(uuid) from public;

grant execute on function public.create_lead_followup(uuid, timestamp with time zone, text, text) to authenticated;
grant execute on function public.complete_lead_followup(uuid, text) to authenticated;
grant execute on function public.cancel_lead_followup(uuid) to authenticated;

commit;
