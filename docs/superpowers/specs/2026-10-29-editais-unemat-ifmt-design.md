# Editais da UNEMAT e do IFMT

Data: 2026-10-29. Aprovado pelo usuário em conversa ("pode fazer tudo").

## Objetivo

Os editais para estudantes da UNEMAT e do IFMT entram no site como os da UFMT. Cada um aparece só para quem estuda na instituição e, quando o edital é de um câmpus, só para quem é daquele câmpus.

## Fontes (checadas em 2026-10-29)

**UNEMAT**
- robots.txt de `unemat.br` e de `cms.unemat.br` liberam tudo. O site tem só política de privacidade, sem termos de uso.
- Lista: a página `/editais` mostra só os 15 mais recentes. O site busca o resto por categoria com `POST /editais/busca`:
  - campos do formulário `tipoEdital` e `numero_pagina_editais`;
  - token CSRF da meta `csrf-token` e o cookie de sessão do `GET /editais`;
  - resposta `{ editais: "<html>" | null }`.
- Cada item traz dia e mês ("23", "OCT") sem ano, o link da página do edital, o título e a categoria.
- A página do edital lista os documentos (`a.edital-documento-titulo`, PDFs em `cms.unemat.br`), do mais novo ao mais antigo. O edital principal é o primeiro que não é "Edital Complementar", "Resultado", "Retificação" nem "Homologação"; se todos forem, vale o mais antigo.
- Categorias de estudante, pelo id de `tipoEdital`:
  - Estágio: 22 Contratação de Estagiários (tipo "internship").
  - Bolsa ou auxílio (tipo "scholarship"): 19, 20, 21, 23, 32, 38, 39, 40, 43, 45, 75, 76, 101, 102, 103, 104, 105, 115.
  - Ficam de fora: preceptoria, contratações, eleições, pós-graduação, vestibular e SISU.

**IFMT**
- robots.txt de `ifmt.edu.br` libera tudo, e o site só tem a página da LGPD.
- Fonte: API pública do WordPress, `GET /wp-json/wp/v2/edital?per_page=100&page=N&_fields=id,date,link,title,content,class_list`.
- O `class_list` traz as marcações:
  - `publico-alvo-edital-estudante-medio`, `-estudante-superior` e `-estudante-pos-graduacao` viram os níveis `high_school`, `undergraduate` e `graduate`+`phd`;
  - `unidade-edital-<slug>` dá o câmpus;
  - `area-edital-estagio` define o tipo "internship".
- Sem nenhuma marcação de estudante, o edital fica de fora.
- Os PDFs ficam no Google Drive, e o robots.txt do Drive proíbe o download automático (`/uc`). Por isso não são baixados: prazo, valor e resumo saem do texto do post. O link oficial é a página do post no site do IFMT.

## Regras comuns

- Só entram editais publicados nos últimos 60 dias, com uma requisição por segundo por host.
- Os dois coletores são opcionais na coleta diária (`requireResults: false`).
- Títulos de resultado, retificação, homologação, edital complementar, docente, professor, servidor, tutor e eleição ficam de fora.
- O prazo vem de `parseInscriptionPeriod`, o resumo de `parseSummary` e a bolsa de `parseStipend`.
  - No IFMT, sem a frase "torna público", o resumo é a primeira frase do post, com até 240 caracteres.
- Editais que já publicaram "Resultado Final" ou "Resultado Definitivo" ficam de fora. Na UNEMAT, isso aparece nos documentos da página; no IFMT, no texto do post.
- UNEMAT: fica de fora o edital cujo título só cita anos anteriores ao da publicação (por exemplo "EDITAL 005_2021"). O site relista editais antigos com data nova.
- IFMT: sem prazo lido, o edital fica só 30 dias, porque as seleções duram poucas semanas.
- Sem prazo, o card mostra a nota "Prazo e requisitos: veja no edital". Com o prazo vencido, o edital é descartado.
- `eligibility.institutions` é `["UNEMAT"]` ou `["IFMT"]`.
  - `campuses`: o câmpus encontrado.
  - No IFMT, vale a lista de unidades. A Reitoria, ou mais de 3 unidades, conta como edital para todos (`null`).
- A cidade do edital é a cidade do câmpus. O padrão é Cáceres (sede da UNEMAT) e Cuiabá (Reitoria do IFMT).

## Instituições e câmpus (`src/lib/institutions.ts`)

Uma lista central com os câmpus de UFMT, UNEMAT e IFMT. Cada câmpus tem nome, cidade e apelidos para encontrá-lo no texto.
- A UNEMAT tem 13 câmpus; o do Médio Araguaia fica em Luciara.
- O IFMT tem 25 unidades mais a Reitoria; os dois de Cuiabá chamam "Cuiabá - Octayde" e "Cuiabá - Bela Vista".

`campusFromText(instituição, texto)` substitui o `campusFromTitle` da UFMT. Ela só procura o câmpus quando o texto diz "campus" ou "câmpus".

## Perfil

- O campo "Universidade" passa a se chamar "Instituição de ensino".
- As sugestões de câmpus seguem a instituição digitada (UFMT, UNEMAT ou IFMT).
- Os textos de elegibilidade usam o artigo certo: "do IFMT", "da UFMT".
- O aviso da home diz "instituição e câmpus".
- Não há migração no banco.
