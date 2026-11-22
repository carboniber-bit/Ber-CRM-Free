-- Etapa 1 — schema inicial de perfis
-- Execute este arquivo no Supabase Dashboard → SQL Editor.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Projetos Supabase novos não concedem grants automaticamente.
-- O papel authenticated precisa de SELECT/UPDATE; o RLS abaixo restringe ao próprio perfil.
-- Nenhum grant para anon: perfis só são acessíveis com login.
grant select, update on public.profiles to authenticated;

-- Cada usuário lê apenas o próprio perfil.
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- Cada usuário edita apenas o próprio perfil.
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Sem policies de insert/delete para usuários comuns:
-- o perfil é criado pela trigger abaixo e removido em cascata com o usuário.

-- Cria o perfil automaticamente quando um usuário é criado em auth.users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mantém updated_at atualizado em cada update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();