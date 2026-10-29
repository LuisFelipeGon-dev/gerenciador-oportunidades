-- Editais da UFMT (Fase 3): resumo lido do PDF do edital, e universidade e câmpus no perfil
-- (obrigatórios no formulário; perfis antigos ficam com vazio até a pessoa completar).

alter table public.opportunities add column summary text check (char_length(summary) <= 300);

alter table public.profiles
  add column institution text check (char_length(institution) <= 80),
  add column campus text check (char_length(campus) <= 80);
