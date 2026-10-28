# Alertas semanais por e-mail: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toda segunda, quem tem conta e ligou o alerta recebe um e-mail com as novidades que servem para o perfil e os prazos dos salvos dos próximos 7 dias.

**Architecture:** Uma função pura (`buildDigest`) escolhe o conteúdo reaproveitando os filtros do site; outra (`renderDigest`) monta assunto, HTML e texto. Um script Node (`scripts/alerts.ts`), rodado por um workflow semanal do GitHub Actions, lê os perfis com a chave de serviço e envia pelo Gmail com `nodemailer`. O consentimento e o cancelamento ficam no banco (migração 0007).

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase (Postgres + Auth), Vitest, `nodemailer`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-28-alertas-email-design.md`

## Global Constraints

- Interface em português, código e nomes em inglês; README sem emojis.
- Envio só pelo Gmail com `GMAIL_USER` e `GMAIL_APP_PASSWORD` (segredos do GitHub; nunca no repositório).
- Alerta começa desligado; liga só com a caixa marcada (`alerts_enabled_at` registra quando).
- Workflow: segunda às 11:00 UTC (`0 11 * * 1`), mais `workflow_dispatch`; roda `npm test` antes.
- No máximo 1 e-mail por segundo.
- Novidades: no máximo 10, ordenadas pelo que fecha primeiro; primeiro envio olha os últimos 7 dias.
- Prazos dos salvos: de hoje até 7 dias.
- Sem nada nas duas listas, não envia.
- Link do item: `${SITE_URL}/#o=${encodeURIComponent(itemKey)}`; `SITE_URL` padrão `https://gerenciador-oportunidades.vercel.app`.
- Link de cancelar: `${SITE_URL}/alertas/cancelar?t=${token}`.

## Review Focus

1. **Título ou organizador com `<`, `&` ou aspas** (vêm das fontes): o HTML do e-mail mostra o texto, sem quebrar nem injetar marcação. Teste em `renderDigest` (Task 3).
2. **Perfil sem cidade encontrada no IBGE**: presenciais entram pelo estado, como no site, sem erro. Teste em `buildDigest` (Task 2).
3. **Conta com alerta ligado mas sem perfil completo** (linha em `profiles` que não passa no `profileSchema`): o script pula essa pessoa e segue. Teste do helper `profileFromRow` retornando `null` (Task 1).
4. **Falha de SMTP em um destinatário**: os outros recebem; o que falhou não tem `alerts_last_sent_at` atualizado; o script sai com código 1. Coberto pela função `sendDigests` com um `send` falso (Task 4).
5. **Item salvo que já fechou ou saiu do banco**: não aparece em "prazos" nem quebra a montagem. Teste em `buildDigest` (Task 2).

---

### Task 1: Banco e mapeamento do perfil

**Files:**
- Create: `supabase/migrations/0007_alerts.sql`
- Create: `src/lib/profile-row.ts`
- Create: `src/lib/profile-row.test.ts`
- Modify: `src/lib/account.ts` (usar o novo módulo; remover `ProfileRow`, `toRow`, `fromRow` locais)

**Interfaces:**
- Produces: `type ProfileRow` (todas as colunas de `profiles`, incluindo `radius_km`, `alerts_enabled: boolean`, `alerts_enabled_at: string | null`, `alerts_token: string`, `alerts_last_sent_at: string | null`); `profileToRow(userId: string, p: Profile): Record<string, unknown>`; `profileFromRow(row: ProfileRow): Profile | null`.

- [ ] **Step 1: Escrever a migração 0007** com as quatro colunas da especificação (`alerts_enabled boolean not null default false`, `alerts_enabled_at timestamptz`, `alerts_token uuid not null default gen_random_uuid()`, `alerts_last_sent_at timestamptz`), a função `public.unsubscribe_alerts(token uuid) returns boolean` (`security definer`, `set search_path = ''`, `update public.profiles set alerts_enabled = false where alerts_token = token`, retorna `found`), `revoke all ... from public` e `grant execute ... to anon, authenticated`. Revogar update de `alerts_token` e `alerts_last_sent_at` para `authenticated` com `revoke update (alerts_token, alerts_last_sent_at) on public.profiles from authenticated`.

- [ ] **Step 2: Teste que falha** em `profile-row.test.ts`:
  - `profileFromRow` de uma linha completa devolve o `Profile` com `radiusKm` vindo de `radius_km`;
  - `radius_km: null` vira 100;
  - linha sem `course` devolve `null`;
  - `profileToRow` e `profileFromRow` fazem ida e volta do mesmo `Profile`.

- [ ] **Step 3: Rodar** `npx vitest run src/lib/profile-row.test.ts`. Esperado: FAIL (módulo não existe).

- [ ] **Step 4: Criar `src/lib/profile-row.ts`** movendo `ProfileRow`, `toRow` (como `profileToRow`) e `fromRow` (como `profileFromRow`) de `account.ts`, sem `"use client"`. `account.ts` passa a importar dali.

- [ ] **Step 5: Rodar** `npm test` e `npm run typecheck`. Esperado: tudo passa.

- [ ] **Step 6: Commit** `git commit -m "Colunas e funcao de cancelamento dos alertas; mapeamento do perfil compartilhado"`

### Task 2: Escolha do conteúdo (`buildDigest`)

**Files:**
- Create: `src/lib/digest.ts`
- Create: `src/lib/digest.test.ts`

**Interfaces:**
- Consumes: `Profile`, `effectiveInterests`, `isExcluded`, `itemKey`, `keyDate`, `daysUntil` (`src/lib/personalize.ts`); `distanceKm`, `Point` (`src/lib/geo.ts`).
- Produces:
  ```ts
  type DigestItem = { o: Opportunity; distanceKm: number | null };
  type Digest = { fresh: DigestItem[]; moreFresh: number; closing: DigestItem[] };
  function buildDigest(input: {
    items: Opportunity[]; programs: Opportunity[]; profile: Profile; today: string;
    origin: Point | null; savedKeys: string[];
    addedAt: Map<string, string>;   // itemKey -> created_at (ISO)
    since: string | null;           // alerts_last_sent_at; null = primeiro envio
  }): Digest;
  function isEmptyDigest(d: Digest): boolean;
  ```

- [ ] **Step 1: Testes que falham** em `digest.test.ts`, com itens montados como em `agenda.test.ts`:
  - `fresh` só tem itens com `addedAt` depois de `since`;
  - com `since: null`, entram os adicionados nos 7 dias antes de `today`;
  - item de tipo fora dos interesses fica fora; item com `isExcluded` (idade mínima maior) fica fora;
  - presencial a 300 km com raio 100 fica fora; online entra;
  - com `origin: null`, presencial do mesmo estado entra e de outro estado fica fora;
  - 12 itens novos: `fresh.length === 10`, `moreFresh === 2`, ordenados por `keyDate`;
  - salvo com prazo em 3 dias entra em `closing`; salvo com prazo em 10 dias e salvo já fechado (prazo ontem) ficam fora; chave salva sem item correspondente é ignorada;
  - `isEmptyDigest` é `true` quando as duas listas estão vazias.

- [ ] **Step 2: Rodar** `npx vitest run src/lib/digest.test.ts`. Esperado: FAIL.

- [ ] **Step 3: Implementar** `buildDigest` e `isEmptyDigest` em `src/lib/digest.ts`. Filtro de alcance igual ao de `agendaEntries` (online sempre; presencial no Brasil dentro de `profile.radiusKm` quando há distância, senão mesmo estado). `closing` usa `keyDate` entre `today` e `today + 7` e procura itens e programas.

- [ ] **Step 4: Rodar** os testes. Esperado: PASS.

- [ ] **Step 5: Commit** `git commit -m "buildDigest: novidades do perfil e prazos dos salvos"`

### Task 3: Texto do e-mail (`renderDigest`)

**Files:**
- Create: `src/lib/digest-email.ts`
- Create: `src/lib/digest-email.test.ts`

**Interfaces:**
- Consumes: `Digest`, `DigestItem` (Task 2); `itemKey`, `keyDate` (`personalize.ts`).
- Produces: `digestSubject(d: Digest): string`; `renderDigest(d: Digest, opts: { siteUrl: string; unsubscribeUrl: string; email: string }): { subject: string; html: string; text: string }`.

- [ ] **Step 1: Testes que falham:**
  - assunto: `fresh` 3 e `closing` 2 → `"3 oportunidades pra você e 2 prazos esta semana"`; 1 e 0 → `"1 oportunidade pra você"`; 0 e 1 → `"1 prazo esta semana"`;
  - `html` e `text` contêm o link `${siteUrl}/#o=devpost%3A123` do item e o `unsubscribeUrl`;
  - título `Hack <b>&</b> "IA"` aparece no `html` como `Hack &lt;b&gt;&amp;&lt;/b&gt; &quot;IA&quot;`;
  - `moreFresh: 2` gera a linha "e mais 2 no site";
  - rodapé diz o e-mail de destino e por que a pessoa recebe.

- [ ] **Step 2: Rodar** e ver FAIL.

- [ ] **Step 3: Implementar.** HTML com estilos inline, largura máxima 600 px, cores do tema claro (`#0c2a66` cabeçalho, `#1d4fd8` links). Escapar todo texto vindo das fontes com uma função `escapeHtml` local. Datas como `DD/MM` (`shortDate` não pode ser importado de `_components`, reescrever o formatador em UTC).

- [ ] **Step 4: Rodar** e ver PASS.

- [ ] **Step 5: Commit** `git commit -m "renderDigest: assunto, HTML e texto do resumo semanal"`

### Task 4: Script de envio e workflow

**Files:**
- Create: `scripts/alerts.ts`
- Create: `src/lib/send-digests.ts`
- Create: `src/lib/send-digests.test.ts`
- Create: `.github/workflows/alerts.yml`
- Modify: `package.json` (dependência `nodemailer`, devDependency `@types/nodemailer`, script `"alerts": "tsx --env-file-if-exists=.env.local scripts/alerts.ts"`)
- Modify: `.gitignore` (`alerts-preview/`)

**Interfaces:**
- Consumes: `buildDigest`, `isEmptyDigest` (Task 2); `renderDigest` (Task 3); `profileFromRow`, `ProfileRow` (Task 1); `dedupe` (`src/lib/dedupe.ts`); `fromRow` (`src/lib/opportunity-row.ts`); `findMunicipality` (`src/lib/geo.ts`); `loadMunicipalities` (`src/collectors/geocode.ts`).
- Produces: `sendDigests(recipients: Recipient[], send: (msg: { to: string; subject: string; html: string; text: string }) => Promise<void>, opts: { delayMs: number }): Promise<{ sent: string[]; failed: string[] }>`, onde `Recipient = { userId: string; email: string; subject: string; html: string; text: string }`.

- [ ] **Step 1: Teste que falha** em `send-digests.test.ts`: com um `send` falso que rejeita para `b@x`, `sendDigests([a, b, c], send, { delayMs: 0 })` devolve `sent: [a, c]` e `failed: [b]`, e `send` foi chamado 3 vezes na ordem.

- [ ] **Step 2: Rodar** e ver FAIL. **Step 3: Implementar** `sendDigests` (laço sequencial, espera `delayMs` entre envios, captura erro por destinatário). **Step 4: Rodar** e ver PASS.

- [ ] **Step 5: Escrever `scripts/alerts.ts`:**
  - lê `profiles` com `alerts_enabled = true`, e-mails por `supabase.auth.admin.getUserById`, `saved_opportunities` por usuário, `open_opportunities` (com `created_at`) e programas curados (`source = 'curated'`);
  - monta `addedAt` de `created_at`, aplica `dedupe`, acha a cidade com `findMunicipality(municipios[uf], city)`;
  - pula perfis com `profileFromRow` nulo ou digest vazio;
  - `--dry-run`: grava `alerts-preview/<userId>.html` e não envia nem atualiza;
  - `--to=<email>`: só esse destinatário;
  - envia com `nodemailer.createTransport({ service: "gmail", auth: { user, pass } })`, remetente `"Oportunidades para estudantes" <GMAIL_USER>`;
  - depois do envio, `alerts_last_sent_at = now()` só para `sent`; sai com código 1 se `failed` não estiver vazio.

- [ ] **Step 6: Workflow** `.github/workflows/alerts.yml` copiando a estrutura de `collect.yml` (checkout, node 24, `npm ci`, `npm test`), cron `0 11 * * 1`, `workflow_dispatch`, passo `npm run alerts` com `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`.

- [ ] **Step 7: Verificar** `npm run typecheck`, `npx eslint src scripts`, `npm test` e `npm run alerts -- --dry-run`. Esperado: sem erros; "0 recipients" enquanto ninguém ligou o alerta.

- [ ] **Step 8: Commit** `git commit -m "Script e workflow semanal de envio dos alertas"`

### Task 5: Interface, cancelamento e política

**Files:**
- Modify: `src/lib/account.ts` (`useAlerts(): { enabled: boolean; email: string } | null` e `setAlerts(enabled: boolean): Promise<string | null>`)
- Modify: `src/app/_components/profile-form.tsx` (caixa do alerta)
- Create: `src/app/alertas/cancelar/page.tsx` e `src/app/alertas/cancelar/unsubscribe.tsx`
- Modify: `src/app/privacidade/page.tsx` (parágrafo do alerta e nova data), `src/lib/account.ts` (`PRIVACY_VERSION = "2026-10-28"`)
- Modify: `README.md`, `PLANO.md`

**Interfaces:**
- Consumes: `unsubscribe_alerts(token uuid)` (Task 1), `browserClient()`.

- [ ] **Step 1: `setAlerts`** atualiza `alerts_enabled` e, quando liga, `alerts_enabled_at = now`; devolve mensagem de erro ou `null`. `useAlerts` lê `alerts_enabled` do perfil da sessão.

- [ ] **Step 2: Formulário de perfil:** com sessão, caixa desmarcada "Quero um resumo por e-mail toda segunda com o que serve pra mim" e a linha "Vai para <email>. Dá para parar a qualquer momento."; sem sessão, "Entre com seu e-mail para receber um resumo semanal" com link para `/entrar`.

- [ ] **Step 3: Página `/alertas/cancelar`:** componente cliente lê `t` da URL, chama `supabase.rpc("unsubscribe_alerts", { token: t })`; mostra "Pronto, você não vai mais receber o resumo semanal." ou, para token inválido ou ausente, "Este link não é válido. Para parar o resumo, desmarque a opção no seu perfil.", com link para o site. Página com o mesmo cabeçalho de `/ajustes`.

- [ ] **Step 4: Privacidade e documentação:** parágrafo "Resumo por e-mail" (o que é enviado, que sai de um Gmail do projeto pelo Google, como parar) e data nova; README ganha a seção do alerta (segredos, `npm run alerts -- --dry-run` e `--to=`); PLANO marca o item e registra o risco de entregabilidade sem domínio.

- [ ] **Step 5: Verificar no navegador** (Chrome sem interface, como nas outras telas): formulário com e sem sessão, página de cancelamento com token inválido, temas claro e escuro, celular e computador. Rodar `npm test`, `npm run typecheck`, lint e build.

- [ ] **Step 6: Commit** `git commit -m "Opcao do resumo semanal no perfil, pagina de cancelamento e politica atualizada"`

### Task 6: Teste real de ponta a ponta

- [ ] **Step 1:** Pedir à pessoa que aplique a migração 0007 no Supabase (SQL Editor) e rode `notify pgrst, 'reload schema';`.
- [ ] **Step 2:** Pedir que ligue o alerta no próprio perfil e conferir a coluna no banco.
- [ ] **Step 3:** Rodar `npm run alerts -- --dry-run`, abrir o HTML gerado e mostrar a prévia.
- [ ] **Step 4:** Rodar `npm run alerts -- --to=<e-mail da pessoa>` (com `GMAIL_USER` e `GMAIL_APP_PASSWORD` no `.env.local`) e pedir confirmação de que chegou, inclusive o link de cancelar.
- [ ] **Step 5:** Subir e disparar o workflow "alerts" manualmente uma vez.
