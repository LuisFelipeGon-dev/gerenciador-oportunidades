-- A view usa "o.*", que fixa as colunas quando é criada: recriar para incluir "summary"
-- (migração 0008). Mesma definição da 0003. Toda migração que acrescenta coluna em
-- opportunities precisa recriar esta view.
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
