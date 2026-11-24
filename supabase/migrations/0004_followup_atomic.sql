begin;

create or replace function public.next_pending_followup(p_lead_id uuid)
returns timestamptz
language sql
volatile
security invoker
set search_path = ''
as $$
  select min(pending.due_at)
  from public.lead_followups as pending
  where pending.lead_id = p_lead_id
    and pending.status = 'pendente';
$$;

revoke all on function public.next_pending_followup(uuid) from public;
grant execute on function public.next_pending_followup(uuid) to authenticated;

-- As garantias valem também para DML direto autenticado.
create or replace function public.enforce_lead_next_contact()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.next_contact_at := public.next_pending_followup(new.id);
  return new;
end;
$$;

create trigger leads_enforce_next_contact_insert
before insert on public.leads
for each row execute function public.enforce_lead_next_contact();

create trigger leads_enforce_next_contact_update
before update of next_contact_at on public.leads
for each row execute function public.enforce_lead_next_contact();

create or replace function public.sync_followup_next_contact()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if TG_OP = 'DELETE' then
    update public.leads
    set next_contact_at = public.next_pending_followup(old.lead_id)
    where id = old.lead_id;
  elsif TG_OP = 'INSERT' then
    update public.leads
    set next_contact_at = public.next_pending_followup(new.lead_id)
    where id = new.lead_id;
  elsif old.lead_id is distinct from new.lead_id then
    update public.leads
    set next_contact_at = public.next_pending_followup(old.lead_id)
    where id = old.lead_id;
    update public.leads
    set next_contact_at = public.next_pending_followup(new.lead_id)
    where id = new.lead_id;
  else
    update public.leads
    set next_contact_at = public.next_pending_followup(new.lead_id)
    where id = new.lead_id;
  end if;
  return null;
end;
$$;

create trigger lead_followups_sync_next_contact
after insert or update or delete on public.lead_followups
for each row execute function public.sync_followup_next_contact();

create or replace function public.log_followup_completion()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status = 'pendente' and new.status = 'concluido' then
    insert into public.lead_activities (owner_id, lead_id, user_id, type, description)
    values (
      new.owner_id,
      new.lead_id,
      (select auth.uid()),
      'follow_up',
      case when new.result is null or btrim(new.result) = ''
        then 'Follow-up concluído.'
        else 'Follow-up concluído: ' || new.result
      end
    );
  end if;
  return new;
end;
$$;

create trigger lead_followups_log_completion
after update of status on public.lead_followups
for each row execute function public.log_followup_completion();

create or replace function public.create_lead_followup(
  p_lead_id uuid,
  p_due_at timestamptz,
  p_reason text default null,
  p_note text default null
)
returns public.lead_followups
language plpgsql
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

  return v_followup;
end;
$$;

create or replace function public.complete_lead_followup(
  p_followup_id uuid,
  p_result text default null
)
returns public.lead_followups
language plpgsql
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

  return v_followup;
end;
$$;

create or replace function public.cancel_lead_followup(p_followup_id uuid)
returns public.lead_followups
language plpgsql
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

  return v_followup;
end;
$$;

revoke all on function public.create_lead_followup(uuid, timestamptz, text, text) from public;
revoke all on function public.complete_lead_followup(uuid, text) from public;
revoke all on function public.cancel_lead_followup(uuid) from public;

grant execute on function public.create_lead_followup(uuid, timestamptz, text, text) to authenticated;
grant execute on function public.complete_lead_followup(uuid, text) to authenticated;
grant execute on function public.cancel_lead_followup(uuid) to authenticated;

commit;
