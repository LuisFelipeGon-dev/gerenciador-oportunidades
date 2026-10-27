-- Fase 1: fontes sem prazo de inscrição (MLH, GDG) e encerramento de itens que somem da fonte.

-- Coletas seguidas em que o item não apareceu na fonte. Com 2, o coletor marca como encerrado.
alter table public.opportunities
  add column missed_runs integer not null default 0 check (missed_runs >= 0);

-- Sem prazo de inscrição, vale a data do evento: some depois que o evento termina.
-- sort_date ordena tudo pela data que importa (prazo ou, na falta dele, início).
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
