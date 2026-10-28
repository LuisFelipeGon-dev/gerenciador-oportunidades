-- Fase 1: contas. Perfil completo, oportunidades salvas e exclusão da conta pela própria pessoa.

-- Perfil: a data de nascimento substitui "maior de 18" (permite checar idade mínima de 16, 14 etc.).
alter table public.profiles
  add column name text check (char_length(name) <= 60),
  add column course text check (char_length(course) <= 80),
  add column area text,
  add column birth_date date check (birth_date >= date '1900-01-01'),
  -- LGPD: quando e qual versão da política de privacidade a pessoa aceitou.
  add column consented_at timestamptz,
  add column privacy_version text,
  drop column is_adult,
  add constraint profiles_study_level_check
    check (study_level in ('high_school', 'undergraduate', 'graduate', 'phd')),
  add constraint profiles_interests_check
    check (interests <@ array['hackathon', 'ambassador', 'event', 'scholarship', 'internship']::text[]);

-- Oportunidades salvas. item_key = "<fonte>:<id na fonte>", estável entre coletas.
create table public.saved_opportunities (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_key text not null check (char_length(item_key) <= 300),
  created_at timestamptz not null default now(),
  primary key (user_id, item_key)
);

alter table public.saved_opportunities enable row level security;

create policy "own saved: select" on public.saved_opportunities for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "own saved: insert" on public.saved_opportunities for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "own saved: delete" on public.saved_opportunities for delete
  to authenticated using ((select auth.uid()) = user_id);

grant select, insert, delete on public.saved_opportunities to authenticated;

-- Apagar a própria conta (LGPD). Roda com permissão de dono só para a linha de quem chama;
-- perfil e salvos somem junto pelo "on delete cascade".
create function public.delete_my_account() returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
