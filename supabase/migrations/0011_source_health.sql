-- Saúde de cada fonte da coleta: quantas vezes seguidas ela falhou. A coleta diária só termina
-- com erro (e o GitHub manda e-mail) quando uma fonte falha 3 vezes seguidas ou para de rodar,
-- e não a cada bloqueio passageiro. Escrita e leitura só com a service role (coletores).

create table public.source_health (
  source text primary key check (char_length(source) <= 50),
  failures integer not null default 0 check (failures >= 0),
  last_ok_at timestamptz,
  last_error text check (char_length(last_error) <= 1000),
  updated_at timestamptz not null default now()
);

-- RLS sem políticas: só a service role, que ignora o RLS, lê e escreve.
alter table public.source_health enable row level security;
