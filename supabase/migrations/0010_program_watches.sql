-- "Me avise quando abrir": quem acompanha um programa fechado recebe um e-mail quando as
-- inscrições abrirem. item_key = "curated:<id>", como nos salvos. notified_at é gravado pelo
-- script de envio (chave de serviço) e impede um segundo aviso; desligar e ligar de novo apaga
-- e recria a linha.

create table public.program_watches (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_key text not null check (char_length(item_key) <= 300),
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  primary key (user_id, item_key)
);

alter table public.program_watches enable row level security;

create policy "own watches: select" on public.program_watches for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "own watches: insert" on public.program_watches for insert
  to authenticated with check ((select auth.uid()) = user_id and notified_at is null);
create policy "own watches: delete" on public.program_watches for delete
  to authenticated using ((select auth.uid()) = user_id);

grant select, insert, delete on public.program_watches to authenticated;

create index program_watches_pending_idx on public.program_watches (item_key) where notified_at is null;
