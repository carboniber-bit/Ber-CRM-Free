begin;

alter table public.leads
  add column if not exists maps_url text;

commit;
