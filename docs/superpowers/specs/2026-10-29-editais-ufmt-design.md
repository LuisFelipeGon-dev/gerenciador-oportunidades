# Editais da UFMT (Fase 3, primeira etapa): design

29/10/2026 · aprovado na conversa, falta revisão desta especificação

## Objetivo

Trazer para o Topa? os editais da UFMT feitos para estudantes (bolsas PET, monitoria, iniciação científica, extensão, assistência estudantil), com prazo de inscrição, resumo e link do PDF oficial. Hoje eles só existem como PDFs espalhados nas páginas das pró-reitorias. É o diferencial 4 do PLANO.

Sucesso: um estudante da UFMT vê, em "Para você" e na Agenda, os editais abertos que servem para ele, com o prazo certo ou um aviso claro de que o prazo precisa ser conferido no PDF.

## Decisões

| Ponto | Decisão |
| --- | --- |
| Fonte | API do portal da UFMT, `https://api-portal.ufmt.br/v1/publications?branch=<id>&page=<n>` (a mesma que o site público usa). Uso autorizado pelo dono do projeto em 29/10/2026. |
| Unidades | PROEG (17), PRAE (11), PROPESQ (13), PROCEV (10). PROPG (18) fica para depois. |
| Extração | Por regras, sem IA e sem custo: texto do PDF com uma biblioteca local, datas e trechos por padrões. |
| Universidade e câmpus | Novos campos opcionais no perfil; edital da UFMT só "serve" para quem é da UFMT e, quando o título cita o câmpus, desse câmpus. |
| FAPEMAT | Fora desta etapa: o robots.txt bloqueia robôs. Entra depois por lista curada. |

## Coleta (`src/collectors/ufmt.ts`)

1. Para cada unidade, ler a primeira página de `publications` (uma requisição por segundo, User-Agent do robô).
2. Manter só publicações:
   - com data de publicação nos últimos 60 dias;
   - com título que indica edital para estudantes: contém "edital" e alguma das palavras seleção, bolsista, bolsa, monitoria, estudante, aluno, discente, PET, iniciação, PIBIC, extensão, auxílio, mobilidade, permanência, intercâmbio, idioma;
   - sem palavras de editais que não são para estudantes: docente, professor, servidor, técnico-administrativo, tutor(a) docente, regularização, resultado, homologação, retificação.
3. Para cada uma, baixar o primeiro PDF (`files[0].filename`) e extrair o texto. PDF que falha é registrado e o edital entra sem os campos do PDF.
4. Montar a oportunidade:
   - `type: "scholarship"`, `source: "ufmt"`, `sourceId`: id da publicação; `organizer`: "UFMT · <sigla da unidade>"; `tags`: ["Edital UFMT", categoria da API].
   - `title`: título da API, sem o código de setor (ex.: "PROEG/CFD/GPE") quando possível, mantendo número e assunto.
   - `officialUrl`: o PDF.
   - `modality: "in_person"`; local: câmpus citado no título (Cuiabá, Várzea Grande, Sinop, Araguaia) ou Cuiabá; `country: "BR"`, `state: "MT"`.
   - `registrationDeadline`: fim do período de inscrição lido do PDF; sem leitura segura, `null`.
   - `startsOn`: início do período de inscrição, quando lido.
   - `eligibility.institutions: ["UFMT"]`, `eligibility.levels: ["undergraduate"]` e `eligibility.campuses: [câmpus]` quando o título cita o câmpus.
   - `benefits`: valor da bolsa ("Bolsa de R$ 700,00") quando lido.
   - `note`: sempre "Lido automaticamente do edital: confira datas e requisitos no PDF."; quando o prazo não foi lido, "Prazo e requisitos: veja no edital.".
   - `summary` (campo novo, opcional): resumo de até 240 caracteres.
5. Item com prazo já passado não entra (`status` só `open`).

## Leitura do PDF (`src/lib/edital-text.ts`, funções puras)

- `parseInscriptionPeriod(text)`: procura, perto de "período de inscrição", "inscrições" ou "das inscrições", intervalos como "De 27 de outubro a 03 de novembro de 2026", "27/10/2026 a 03/11/2026" e "até 03 de novembro de 2026". Ano ausente no início herda o do fim. Devolve `{ start: string | null; end: string } | null`.
- `parseSummary(text)`: a oração depois de "torna público o presente Edital para" (ou "torna pública a abertura"), até o primeiro ponto final ou 240 caracteres, sem quebras de linha, com reticências se cortada.
- `parseStipend(text)`: primeiro valor "R$ 700,00" perto de "bolsa" ou "auxílio".
- `campusFromTitle(title)`: Cuiabá, Várzea Grande, Sinop ou Araguaia quando o título cita o câmpus.

Biblioteca de PDF: `unpdf` (texto de PDF em Node, sem dependências nativas).

## Modelo de dados

- `Opportunity.eligibility` ganha `institutions: string[] | null` e `campuses: string[] | null` (default `null`), salvos no JSON de `eligibility` que já existe. Não há migração para isso.
- `Opportunity.summary: string | null` (default `null`), coluna nova `summary text` em `opportunities` (migração 0008).
- `Profile` ganha `institution: string` e `campus: string` (opcionais, vazios por padrão), colunas `institution text` e `campus text` em `profiles` (migração 0008).

## Perfil e "Posso participar?"

- No formulário, depois de cidade e estado: "Universidade" (texto com sugestões: UFMT, UNEMAT, IFMT, UNIC, UNIVAG, UFR, outra) e, para UFMT, "Câmpus" (Cuiabá, Várzea Grande, Sinop, Araguaia). Os dois são opcionais.
- `checksFor`:
  - com `institutions`: perfil com a instituição na lista mostra ✓ "Para estudantes da UFMT"; perfil com outra instituição mostra ✗ (some de "Para você"); perfil sem instituição mostra "?" "Só para estudantes da UFMT".
  - com `campuses`: perfil da UFMT de outro câmpus mostra ✗ "Só para o câmpus Cuiabá"; sem câmpus no perfil mostra "?".
- Comparação de instituição sem acento e caixa ("ufmt" = "UFMT").

## Interface

- Card e painel de detalhe mostram o resumo (`summary`) quando houver e o aviso `note`.
- Os editais aparecem em "Para você" (perto de você, pelo câmpus) e na Agenda (prazo de inscrição), como os outros itens do tipo `scholarship`.
- "Bolsas" (`scholarship`) entra nos interesses padrão de todas as áreas em `src/lib/areas.ts`: edital da universidade serve a qualquer curso. Quem escolheu interesses à mão continua com a própria escolha.
- O resumo semanal por e-mail inclui os editais como qualquer item novo.

## Testes

- `edital-text`: datas por extenso e numéricas, ano herdado, "até", texto sem período (null), resumo cortado, valor da bolsa, câmpus do título.
- Coletor: resposta da API salva (`__fixtures__/ufmt-publications-proeg.json`) e o PDF do Edital 016/2026 (`__fixtures__/ufmt-edital-016-2026.pdf`). Filtro de títulos (docentes e resultados saem), mapeamento completo do Edital 016, PDF que falha.
- `checksFor`: instituição igual, diferente e ausente; câmpus igual, diferente e ausente.
- Perfil: ida e volta das colunas novas.

## Fora desta etapa

- FAPEMAT (lista curada), PROPG, outras universidades.
- IA para editais fora do padrão (GitHub Models, se a leitura por regras deixar muitos sem prazo).
- Fila de revisão humana: os editais entram direto com o aviso "lido automaticamente".

## Riscos

- **Leitura errada de prazo:** só preenche quando acha o padrão perto de "inscrição"; senão, "veja no edital". O aviso aparece sempre.
- **Mudança na API da UFMT:** o coletor falha alto (sem dados não grava) e o GitHub avisa, como os outros.
- **Editais que não são para estudantes passando no filtro:** a lista de palavras é testada e fácil de ajustar; o botão "reportar erro" pega os casos que escaparem.
