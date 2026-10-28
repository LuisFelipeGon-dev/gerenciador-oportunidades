-- Reportes de erro enviados pelo botão "Reportar erro" do site. Qualquer pessoa pode enviar,
-- com ou sem conta; ninguém lê pelo site. Não guarda quem enviou (nem e-mail, nem id).
-- A coleta diária lê os novos com a chave de serviço e abre uma issue no GitHub.

create table public.reports (
  id bigint generated always as identity primary key,
  item_key text not null check (char_length(item_key) between 3 and 300),
  reason text not null check (reason in ('wrong_date', 'broken_link', 'closed', 'wrong_requirements', 'duplicate', 'other')),
  message text check (char_length(message) <= 500),
  created_at timestamptz not null default now(),
  -- Preenchido quando o reporte entra na issue do GitHub.
  notified_at timestamptz
);

alter table public.reports enable row level security;

-- Só inserir, e sem escolher a data nem marcar como avisado.
create policy "anyone: insert report" on public.reports for insert
  to anon, authenticated with check (notified_at is null);

grant insert (item_key, reason, message) on public.reports to anon, authenticated;
