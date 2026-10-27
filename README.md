# Oportunidades para estudantes

Site público que reúne oportunidades abertas para estudantes (hackathons, programas de embaixador, eventos e bolsas), com prazo, elegibilidade e link oficial. O plano completo está em [PLANO.md](PLANO.md).

Estado atual (Fase 0): lista os hackathons abertos do Devpost, ordenados pelo prazo.

## Stack

- Next.js (App Router, TypeScript, Tailwind)
- Supabase (Postgres e login)
- Coletores em Node, executados com `tsx`
- Zod para validar os dados de cada fonte
- Vitest para os testes

## Como rodar

Requer Node 24.

```bash
npm install
cp .env.example .env.local   # preencha as variáveis
npm run collect              # coleta o Devpost e grava no Supabase
npm run dev                  # http://localhost:3000
```

Para testar a coleta sem gravar nada: `npm run collect -- --dry-run`.

Sem as variáveis do Supabase, o site abre e mostra um aviso no lugar da lista.

## Banco de dados

O esquema está em `supabase/migrations/`. Para aplicar em um projeto novo, cole o conteúdo de `0001_init.sql` no SQL Editor do Supabase e execute.

- `opportunities`: leitura pública; escrita só com a service role (usada pelo coletor).
- `open_opportunities`: view com o que não fechou e ainda está no prazo.
- `profiles`: cada pessoa lê e altera só o próprio perfil (RLS). Apagar a conta apaga o perfil.

## Estrutura

```
src/app/            páginas
src/lib/            esquema da oportunidade, conversão para o banco, leitura do Supabase
src/collectors/     um arquivo por fonte, com teste e resposta salva em __fixtures__
scripts/collect.ts  roda os coletores e grava no Supabase
supabase/           migrações SQL
```

## Regras dos coletores

- No máximo uma requisição por segundo por site, com User-Agent que identifica o robô.
- Se a coleta falhar ou vier vazia, o script termina com erro e não altera o banco.
- Só dados factuais (nome, datas, local, link). Nada de descrições inteiras ou imagens.

## Testes

```bash
npm test
```
