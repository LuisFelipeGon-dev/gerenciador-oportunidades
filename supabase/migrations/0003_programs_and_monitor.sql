-- Fase 1: programas recorrentes (embaixadores) e monitor de mudança nas páginas oficiais.

alter table public.opportunities
  add column typical_open_months smallint[] not null default '{}'
    check (typical_open_months <@ array[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]),
  add column note text;

-- A view usa "o.*": recriar para incluir as colunas novas.
drop view public.open_opportunities;

create view public.open_opportunities
with (security_invoker = true) as
select
  o.*,
  coalesce(o.registration_deadline, o.starts_on) as sort_date
from public.opportunities o
where o.status <> 'closed'
  and case
    when o.registration_deadline is not null then o.registration_deadline >= current_date
    else coalesce(o.ends_on, o.starts_on, current_date) >= current_date
  end;

grant select on public.open_opportunities to anon, authenticated;

-- Último texto visto de cada página monitorada. Só o robô (service role) lê e escreve:
-- RLS ligada e nenhuma política para anon/authenticated.
create table public.page_snapshots (
  url text primary key,
  content_hash text not null,
  content_text text not null,
  checked_at timestamptz not null default now(),
  changed_at timestamptz not null default now()
);

alter table public.page_snapshots enable row level security;
