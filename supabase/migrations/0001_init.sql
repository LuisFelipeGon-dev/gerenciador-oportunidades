-- Fase 0: oportunidades (leitura pública) e perfis (cada pessoa vê só o próprio).

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('hackathon', 'ambassador', 'event', 'scholarship', 'internship')),
  title text not null,
  organizer text,
  official_url text not null check (official_url ~ '^https?://'),
  modality text not null check (modality in ('in_person', 'online', 'hybrid')),
  location_raw text,
  city text,
  state text,
  country char(2),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  starts_on date,
  ends_on date,
  registration_deadline date,
  eligibility jsonb not null default '{}'::jsonb,
  cost text,
  benefits text[] not null default '{}',
  tags text[] not null default '{}',
  scale text check (scale in ('local', 'regional', 'national')),
  source text not null,
  source_id text not null,
  verified_at timestamptz not null,
  status text not null check (status in ('open', 'upcoming', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_id),
  check (starts_on is null or ends_on is null or starts_on <= ends_on)
);

create index opportunities_listing_idx
  on public.opportunities (type, registration_deadline)
  where status <> 'closed';

create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger opportunities_set_updated_at
  before update on public.opportunities
  for each row execute function public.set_updated_at();

alter table public.opportunities enable row level security;

-- Qualquer pessoa lê; só o coletor (service role, que ignora RLS) escreve.
create policy "opportunities are public"
  on public.opportunities for select
  to anon, authenticated
  using (true);

-- O filtro por data roda no banco para o site não depender do relógio no render.
create view public.open_opportunities
with (security_invoker = true) as
select *
from public.opportunities
where status <> 'closed'
  and (registration_deadline is null or registration_deadline >= current_date);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  city text,
  state text,
  country char(2) default 'BR',
  radius_km integer not null default 100 check (radius_km between 1 and 5000),
  interests text[] not null default '{}',
  study_level text,
  is_adult boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "own profile: select" on public.profiles for select
  to authenticated using ((select auth.uid()) = id);
create policy "own profile: insert" on public.profiles for insert
  to authenticated with check ((select auth.uid()) = id);
create policy "own profile: update" on public.profiles for update
  to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "own profile: delete" on public.profiles for delete
  to authenticated using ((select auth.uid()) = id);

-- Grants explícitos: projetos novos podem não expor tabelas do schema public por padrão.
grant select on public.opportunities, public.open_opportunities to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
