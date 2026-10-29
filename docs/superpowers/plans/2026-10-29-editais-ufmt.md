# Editais da UFMT: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Editais da UFMT para estudantes (PROEG, PRAE, PROPESQ, PROCEV) entram no Topa? com prazo, resumo e link do PDF, e só aparecem para quem é da UFMT (e do câmpus, quando o edital é de um câmpus).

**Architecture:** Funções puras leem o texto do PDF (`src/lib/edital-text.ts`); o coletor `src/collectors/ufmt.ts` lê a API do portal, baixa o PDF, extrai o texto com `unpdf` e monta a oportunidade. A elegibilidade ganha `institutions` e `campuses`; o perfil ganha universidade e câmpus obrigatórios; `checksFor` esconde o que não serve.

**Tech Stack:** TypeScript, Zod, Vitest, `unpdf`, Supabase (migração 0008), Next.js 16.

**Spec:** `docs/superpowers/specs/2026-10-29-editais-ufmt-design.md`

## Global Constraints

- Uma requisição por segundo por host, User-Agent do robô (`politeFetchText`/`politeFetchJson`); para o PDF, uma função equivalente que devolve bytes.
- Unidades: PROEG 17, PRAE 11, PROPESQ 13, PROCEV 10. Publicações dos últimos 60 dias.
- Resumo: até 240 caracteres, com "…" quando cortado.
- `note` sempre "Lido automaticamente do edital: confira datas e requisitos no PDF."; sem prazo lido, a nota vira "Prazo e requisitos: veja no edital. Lido automaticamente: confira no PDF."
- Universidade e câmpus obrigatórios no formulário; perfis antigos lidos com `""`.
- Instituição ou câmpus ausente ou diferente no perfil: o edital some (`ok: false`). Visitante sem perfil: aparece com "?".
- Comparações sem acento e caixa.
- Interface em português; código em inglês.

## Review Focus

1. **Edital com período em tabela quebrada em várias linhas** ("Período de inscrição" numa linha, "De 27 de outubro a 03 de novembro de 2026." na seguinte): o prazo é lido. Teste com o texto real do Edital 016 (Task 1).
2. **Datas em outro ano ou mês sem ano no início** ("de 15 de dezembro a 10 de janeiro de 2027"): início fica em 2026. Teste em Task 1.
3. **Perfil salvo antes desta mudança** (sem `institution`/`campus`): continua lido, sem perder dados, e esconde editais da UFMT. Teste em Task 3.
4. **PDF que não abre ou não tem texto** (escaneado): o edital entra com "veja no edital", sem derrubar a coleta. Teste em Task 2.
5. **Título de edital para docentes ou de resultado** ("Resultado final", "Seleção de docentes tutores"): fica fora. Teste em Task 2.

---

### Task 1: Leitura do texto do edital

**Files:** Create `src/lib/edital-text.ts`, `src/lib/edital-text.test.ts`

**Interfaces — Produces:**
- `parseInscriptionPeriod(text: string): { start: string | null; end: string } | null` (datas `YYYY-MM-DD`)
- `parseSummary(text: string): string | null`
- `parseStipend(text: string): string | null` (ex.: `"R$ 700,00"`)
- `campusFromTitle(title: string): "Cuiabá" | "Várzea Grande" | "Sinop" | "Araguaia" | null`

- [ ] **Step 1: Testes que falham:**
  - `"Período de inscrição\nDe 27 de outubro a 03 de novembro de 2026."` → `{ start: "2026-10-27", end: "2026-11-03" }`;
  - `"Inscrições: 27/10/2026 a 03/11/2026"` → mesmo resultado;
  - `"inscrições de 15 de dezembro a 10 de janeiro de 2027"` → `{ start: "2026-12-15", end: "2027-01-10" }`;
  - `"As inscrições vão até 03 de novembro de 2026"` → `{ start: null, end: "2026-11-03" }`;
  - texto sem "inscri" → `null`; data de resultado longe de "inscri" não conta;
  - `parseSummary` do trecho real do Edital 016 → começa com "Processo de Seleção de Estudantes bolsistas e voluntários para o GRUPO PET" e tem no máximo 240 caracteres; sem "torna público" → `null`;
  - `parseStipend("bolsa mensal no valor de R$ 700,00 (setecentos reais)")` → `"R$ 700,00"`; sem valor → `null`;
  - `campusFromTitle("... - CAMPUS CUIABÁ")` → `"Cuiabá"`; `"Câmpus Universitário do Araguaia"` → `"Araguaia"`; sem câmpus → `null`.
- [ ] **Step 2:** `npx vitest run src/lib/edital-text.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3:** Implementar. Normalizar o texto (juntar espaços e quebras); procurar o intervalo só numa janela de até 200 caracteres depois de "inscri"; meses por nome em português.
- [ ] **Step 4:** Rodar → PASS. **Step 5:** commit "Leitura de prazo, resumo, valor e câmpus de editais".

### Task 2: Coletor da UFMT

**Files:** Create `src/collectors/ufmt.ts`, `src/collectors/ufmt.test.ts`, `src/collectors/__fixtures__/ufmt-publications-proeg.json`, `src/collectors/__fixtures__/ufmt-edital-016-2026.pdf`. Modify `src/collectors/http.ts` (`politeFetchBytes`), `src/lib/opportunity.ts` (`eligibility.institutions`, `eligibility.campuses`, `summary`), `src/lib/opportunity-row.ts` (`summary`), `scripts/collect.ts`, `package.json` (`unpdf`). Create `supabase/migrations/0008_editais.sql` (`opportunities.summary`, `profiles.institution`, `profiles.campus`).

**Interfaces:**
- Consumes: Task 1.
- Produces: `isStudentCall(title: string): boolean`; `mapUfmtPublication(p: UfmtPublication, branch: { id: number; acronym: string }, pdfText: string | null, verifiedAt: string): Opportunity | null`; `collectUfmt(options: { verifiedAt: string; fetchJson?: FetchJson; fetchBytes?: FetchBytes; pdfToText?: (bytes: Uint8Array) => Promise<string> }): Promise<{ opportunities: Opportunity[]; skipped: number }>`.
- `Opportunity.eligibility.institutions/campuses: string[] | null` com default `null`; `Opportunity.summary: string | null` com default `null`.

- [ ] **Step 1: Testes que falham:**
  - `isStudentCall`: entram "Edital 016/2026 - Seleção de Bolsistas PET", "Edital de Monitoria 2026/2", "Bolsa Permanência"; saem "Seleção de docentes tutores", "Resultado final do Edital 014/2026", "Retificação do Edital 12/2026", "Regularização de vínculo acadêmico";
  - `mapUfmtPublication` do Edital 016 com o texto do PDF salvo: `registrationDeadline: "2026-11-03"`, `startsOn: "2026-10-27"`, `officialUrl` = o PDF, `source: "ufmt"`, `sourceId: "6899"`, `organizer: "UFMT · PROEG"`, `location.city: "Cuiabá"`, `eligibility.institutions: ["UFMT"]`, `eligibility.campuses: ["Cuiabá"]`, `eligibility.levels: ["undergraduate"]`, `summary` começando com "Processo de Seleção", `note` com "Lido automaticamente";
  - prazo já passado → `null`; `pdfText: null` → item com `registrationDeadline: null` e nota "veja no edital";
  - `collectUfmt` com `fetchJson` falso (fixture para o branch 17, lista vazia para os outros), `fetchBytes` falso e um `pdfToText` que falha para um PDF: coleta segue, `skipped` conta o que saiu pelo filtro ou pela data;
  - publicações com mais de 60 dias ficam fora.
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar; `pdfToText` padrão com `unpdf` (`extractText` com `mergePages: true`). Registrar a fonte em `scripts/collect.ts` com `requireResults: false`. Migração 0008.
- [ ] **Step 4:** `npm test`, `npm run typecheck` e `npm run collect -- --dry-run --only=ufmt` (rede real) → itens da UFMT com prazos lidos.
- [ ] **Step 5:** commit "Coletor dos editais da UFMT pela API do portal".

### Task 3: Perfil com universidade e câmpus; quem não é do público não vê

**Files:** Modify `src/lib/personalize.ts` (`Profile.institution`, `Profile.campus`; `checksFor`), `src/lib/personalize.test.ts`, `src/lib/local-store.ts` (`profileSchema` com default `""`), `src/lib/profile-row.ts` (+ teste), `src/lib/areas.ts` (`scholarship` nos padrões), `src/app/_components/profile-form.tsx`.

**Interfaces:** Consumes `eligibility.institutions/campuses` (Task 2).

- [ ] **Step 1: Testes que falham** em `personalize.test.ts`:
  - perfil UFMT + Cuiabá vê o edital Cuiabá (✓ "Para estudantes da UFMT"); UNEMAT não vê; UFMT Sinop não vê; perfil com `institution: ""` não vê; visitante (`null`) vê com `ok: null`;
  - comparação "ufmt"/"cuiaba" sem acento e caixa;
  - `profileSchema` lê um perfil antigo sem os campos (fica `""`); `profileFromRow` com `institution: null` lê `""` e ida e volta mantém os valores;
  - `effectiveInterests` de qualquer área inclui `scholarship`.
- [ ] **Step 2:** Rodar → FAIL. **Step 3:** Implementar; no formulário, os dois campos obrigatórios com `datalist` (universidades; câmpus da UFMT quando a universidade for UFMT).
- [ ] **Step 4:** Rodar → PASS; typecheck, lint. **Step 5:** commit "Universidade e câmpus no perfil; editais só para o público certo".

### Task 4: Telas: resumo, aviso de perfil incompleto, conferência no navegador

**Files:** Modify `src/app/_components/cards.tsx`, `src/app/_components/detail-drawer.tsx`, `src/app/_components/home.tsx`, `README.md`, `PLANO.md`.

- [ ] **Step 1:** Card e painel mostram `summary` quando houver (o painel no lugar da descrição genérica de "O que é").
- [ ] **Step 2:** Na home, perfil sem universidade ou câmpus mostra no topo de "Para você" o aviso "Complete seu perfil: universidade e câmpus", com botão que abre o formulário.
- [ ] **Step 3:** README (fonte UFMT, campos novos) e PLANO (Fase 3 iniciada; FAPEMAT pendente).
- [ ] **Step 4:** Build e conferência no Chrome sem interface, nos dois temas, computador e celular: formulário com os campos novos, aviso de perfil incompleto, um edital da UFMT no card e no painel. `npm test`, lint, build.
- [ ] **Step 5:** commit "Editais da UFMT nas telas e aviso de perfil incompleto".

### Task 5: Banco e publicação (com a pessoa)

- [ ] Pedir para aplicar a migração 0008 e rodar `notify pgrst, 'reload schema';`.
- [ ] Rodar `npm run collect -- --only=ufmt` (grava) e conferir no site local.
- [ ] Juntar ao `main` e enviar quando a pessoa aprovar.
