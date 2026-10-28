# Oportunidades para estudantes

Site público que reúne oportunidades abertas para estudantes (hackathons, programas de embaixador, eventos e bolsas), com prazo, elegibilidade e link oficial. O plano completo está em [PLANO.md](PLANO.md).

Estado atual (Fase 1, em andamento): lista hackathons do Devpost e da MLH e eventos dos GDGs brasileiros, ordenados pelo prazo ou, sem prazo, pela data de início.

## Fontes

| Fonte | Como é coletada |
| --- | --- |
| Devpost | JSON público `devpost.com/api/hackathons` (não oficial) |
| MLH | JSON embutido na página da temporada (`mlh.com/seasons/<ano>/events`) |
| GDG | Sitemaps mensais de eventos e JSON-LD de cada página de evento. O robots.txt proíbe `/api/` e pede 2 s entre requisições. Só capítulos brasileiros, listados em `src/collectors/gdg-chapters-br.ts` |
| Programas de embaixador | Lista curada em `data/ambassador-programs.yaml`, conferida à mão na página oficial |

## Programas de embaixador e monitor

Os programas ficam em `data/ambassador-programs.yaml`, com um comentário no topo explicando cada campo. Cada item registra a data em que a página oficial foi conferida (`checked_on`). O site mostra também os programas fechados, com o mês em que costumam abrir.

O monitor (`npm run monitor`) baixa a página oficial de cada programa todo dia, compara o texto visível com o da véspera e, se mudou, a coleta diária abre uma issue com a etiqueta `monitor` (ou comenta na que já estiver aberta). Nada é publicado automaticamente: confira a página, atualize o YAML e feche a issue.

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

O esquema está em `supabase/migrations/`. Para aplicar em um projeto novo, cole cada arquivo no SQL Editor do Supabase, em ordem numérica, e execute.

- `opportunities`: leitura pública; escrita só com a service role (usada pelo coletor).
- `open_opportunities`: view com o que não fechou e ainda está no prazo.
- `profiles`: cada pessoa lê e altera só o próprio perfil (RLS). Apagar a conta apaga o perfil.

## Login

Login sem senha pelo Supabase Auth: link mágico e código de 6 dígitos no mesmo e-mail. A sessão fica no navegador, e o RLS garante que cada pessoa só lê e altera o próprio perfil e os próprios salvos. Sem conta, o perfil fica só no navegador.

Configuração no painel do Supabase:

1. Authentication > URL Configuration: Site URL com o endereço da Vercel; em Redirect URLs, `https://<seu-site>/entrar` e `http://localhost:3000/entrar`.
2. Authentication > Emails > Magic Link: o modelo precisa incluir `{{ .Token }}` (o código) além do link.
3. Para uso real, configure um SMTP próprio: o envio padrão do Supabase tem limite baixo de e-mails por hora.

A conta pode ser apagada pela própria pessoa (função `delete_my_account`, migração 0004). A política de privacidade fica em `/privacidade`; ao mudá-la, atualize `PRIVACY_VERSION` em `src/lib/account.ts`.

## Estrutura

```
src/app/            páginas
src/lib/            esquema da oportunidade, conversão para o banco, leitura do Supabase
src/collectors/     um arquivo por fonte, com teste e resposta salva em __fixtures__
scripts/collect.ts  roda os coletores e grava no Supabase
supabase/           migrações SQL
```

## Coleta diária

O workflow `.github/workflows/collect.yml` roda todo dia às 09:17 UTC (05:17 em Cuiabá), e também pode ser disparado à mão na aba Actions. Ele roda os testes e depois a coleta. Se algo falhar, o GitHub avisa por e-mail e o banco fica como estava. O site atualiza a lista em até uma hora.

Segredos necessários no repositório (Settings > Secrets and variables > Actions):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

O GitHub desativa workflows agendados de repositórios públicos depois de 60 dias sem commits. Se isso acontecer, reative na aba Actions.

## Regras dos coletores

- No máximo uma requisição por segundo por site, com User-Agent que identifica o robô.
- Se a coleta falhar ou vier vazia, o script termina com erro e não altera o banco.
- Só dados factuais (nome, datas, local, link). Nada de descrições inteiras ou imagens.

## Testes

```bash
npm test
```
