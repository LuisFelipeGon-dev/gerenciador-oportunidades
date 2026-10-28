-- Tipo "competition" (competições e olimpíadas) para os programas curados em data/programs.yaml.

alter table public.opportunities
  drop constraint opportunities_type_check,
  add constraint opportunities_type_check
    check (type in ('hackathon', 'ambassador', 'event', 'scholarship', 'internship', 'competition'));

alter table public.profiles
  drop constraint profiles_interests_check,
  add constraint profiles_interests_check
    check (interests <@ array['hackathon', 'ambassador', 'event', 'scholarship', 'internship', 'competition']::text[]);
