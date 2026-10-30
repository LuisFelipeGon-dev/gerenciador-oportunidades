# Editais UNEMAT e IFMT: plano de implementação

**Spec:** `docs/superpowers/specs/2026-10-29-editais-unemat-ifmt-design.md`
**Execução:** inline (Native), com TDD, testes rodando contra fixtures reais capturadas em 2026-10-29.

## Tarefas

### 1. Instituições e câmpus
- Criar `src/lib/institutions.ts` com:
  - `INSTITUTIONS` (UFMT, UNEMAT, IFMT → câmpus `{ name, city, aliases }`);
  - `campusFromText(inst, text): string | null`;
  - `campusCity(inst, campus): string | null`;
  - `campusNames(inst): string[]`;
  - `withArticle(inst): string` ("do IFMT", "da UFMT").
- Testes:
  - os casos atuais de `campusFromTitle` da UFMT;
  - "CAMPUS UNIVERSITÁRIO DE PONTES E LACERDA" → "Pontes e Lacerda";
  - sem a palavra câmpus → null.
- Remover `campusFromTitle` de `edital-text.ts`; `ufmt.ts` passa a usar `campusFromText("UFMT", …)` e `campusCity`.

### 2. HTTP com sessão
- Em `http.ts`, criar `politeFetchResponse(url, init)`, um fetch genérico com o mesmo limite por host e o mesmo User-Agent.
- Os helpers atuais passam a usá-lo.

### 3. Coletor UNEMAT (`src/collectors/unemat.ts`)
- `UNEMAT_TYPES`: id → tipo da oportunidade.
- `parseSearchResults(html, today)` → `{ url, title, category, publishedOn }[]`. O ano é deduzido: a data não pode ficar no futuro.
- `mainDocumentUrl(detailHtml)` → URL do PDF.
- `isUnematStudentCall(title)`.
- `mapUnematEdital(item, kind, pdfText, verifiedAt)`.
- `collectUnemat({ verifiedAt, search?, fetchText?, fetchBytes?, pdfToText? })`.
- Fixtures:
  - `unemat-busca-104.json` e `unemat-busca-102.json`;
  - `unemat-edital-009-2026.html`;
  - `src/lib/__fixtures__/unemat-edital-009-2026.txt`.
- Testes:
  - a busca é lida com datas e anos certos;
  - o PDF principal escolhido é o edital 009 e não os complementares;
  - o edital 009 em 2026-10-12 tem prazo 2026-10-23, bolsa de R$ 700,00, instituição UNEMAT e organizador "UNEMAT · PRAE";
  - o mesmo edital é descartado em 2026-10-29, porque o prazo venceu;
  - o câmpus Pontes e Lacerda sai do título do auxílio transporte;
  - títulos de tutor e de resultado ficam de fora.

### 4. Coletor IFMT (`src/collectors/ifmt.ts`)
- `parseIfmtPage(json)`.
- `ifmtTerms(classList)` → `{ levels, units, internship }`.
- `mapIfmtEdital(post, verifiedAt)`.
- `collectIfmt({ verifiedAt, fetchJson? })`, que pagina até passar do corte de 60 dias, no máximo 3 páginas.
- Fixture: `ifmt-editais.json`.
- Testes:
  - Edital 24/2026 (Alta Floresta): superior, prazo 2026-10-02, R$ 400,00 e câmpus Alta Floresta, visto em 2026-09-30;
  - Edital 226/2026: tipo estágio, sem câmpus (Reitoria);
  - Edital 39/2026 (Cáceres): `high_school`;
  - posts sem público estudante e os de docente ficam de fora;
  - os títulos têm as entidades decodificadas.

### 5. Ligações
- `scripts/collect.ts` registra `unemat` e `ifmt`.
- Perfil:
  - o rótulo passa a "Instituição de ensino", com sugestões de câmpus vindas de `campusNames`;
  - a explicação abaixo dos campos é atualizada.
- `personalize.ts` usa `withArticle`, com teste.
- O aviso da home passa a dizer "instituição e câmpus".
- README e PLANO.
- Verificação final:
  - `npm test`, `npx tsc --noEmit` e `npm run build`;
  - uma coleta real em modo de teste dos dois coletores.
