-- Resumo semanal por e-mail. Começa desligado; liga só quando a pessoa marca a opção no perfil
-- (alerts_enabled_at registra quando). alerts_token identifica o link "parar de receber".

alter table public.profiles
  add column alerts_enabled boolean not null default false,
  add column alerts_enabled_at timestamptz,
  add column alerts_token uuid not null default gen_random_uuid(),
  add column alerts_last_sent_at timestamptz;

create unique index profiles_alerts_token_idx on public.profiles (alerts_token);

-- O token e a data do último envio são do sistema de envio (chave de serviço), não do navegador.
revoke update (alerts_token, alerts_last_sent_at) on public.profiles from authenticated;

-- "Parar de receber" pelo link do e-mail, sem login. Só desliga; não revela nada do perfil.
create function public.unsubscribe_alerts(token uuid) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set alerts_enabled = false where alerts_token = token;
  return found;
end;
$$;

revoke all on function public.unsubscribe_alerts(uuid) from public;
grant execute on function public.unsubscribe_alerts(uuid) to anon, authenticated;
