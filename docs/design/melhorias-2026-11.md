# Melhorias de novembro de 2026

Rodada escolhida pelo dono do projeto depois do redesenho. Cada item diz o que mudou, onde está e o que falta fazer fora do código.

## Correções

- **`?` sumia no tema escuro.** A animação de entrada pintava os pontos com `var()` dentro do `@keyframes`; no Safari a cor virava preto. A cor saiu da animação (ver regras em `docs/design/README.md`). O `?` do hero agora aparece a partir de 900px de largura (antes, 1024px).
- **Animações de hover.** O ponto do logo voltou a piscar (o seletor não achava o ícone); o hero tem halo e grade acesa maiores sob o mouse; cada ponto do `?` cresce quando o mouse passa.
- **"Ver mais 1 de 1"** virou "Ver mais 1".

## Itens

### Nome no botão do perfil
`profile-menu.tsx`: o botão mostra o primeiro nome e a inicial (sem nome, "Seu perfil").

### Abas que rolam no celular
`home.tsx`: a linha de abas ganha um degradê na borda onde há abas escondidas (`maskImage` calculado no `scroll`).

### Cartões mais cedo no celular
Números do hero em uma linha, texto do perfil escondido no celular (o botão do perfil já diz quem é), "Próximos prazos" como faixa horizontal (`DeadlineStrip`) e aviso de perfil incompleto compacto. O painel lateral só aparece a partir de `lg`.

### Busca e "Combina comigo"
`src/lib/search.ts` (testado em `search.test.ts`): sem acento e sem maiúsculas, todas as palavras precisam aparecer no título, organização, lugar, temas, benefícios ou rótulos. Atalhos: `/` e Ctrl+K (⌘K). Esc limpa. Na aba "Para você", qualquer busca ou filtro troca as seções por uma lista única de resultados; nas outras abas filtra a lista da aba. "Combina comigo" esconde o que tem requisito que falta (`fitOf` = `no`).

### Lista antes de ler o perfil
`ServerList` em `home.tsx`: o servidor renderiza "Abertas agora" (as 10 próximas e os programas abertos) em vez de "Carregando…". Depois que o navegador lê o perfil, a página troca pelas seções personalizadas. O build marca `/` como estático com revalidação de 1 hora.

### "Me avise quando abrir"
- Botão nos programas fechados (`WatchButton` em `cards.tsx`, no cartão e na gaveta).
- Sem conta, o aviso fica no navegador (`topa:avisos:v1` em `local-store.ts`) e a gaveta convida a entrar. Ao entrar, os avisos do navegador sobem para a conta (`account.ts`, `syncAfterSignIn`).
- Banco: tabela `program_watches` (migração `supabase/migrations/0010_program_watches.sql`), com RLS de dono.
- Envio: `npm run program-alerts` (`scripts/program-alerts.ts`, lógica em `src/lib/program-alerts.ts` com testes). Um e-mail por pessoa quando o programa passa a `open`; `notified_at` impede repetição. Desligar e ligar de novo recria o aviso. `--dry-run` lista sem enviar.
- Roda na coleta diária (`.github/workflows/collect.yml`, passo "Avisos de programas que abriram"), depois da coleta atualizar o status dos programas.

A migração 0010 já foi aplicada no Supabase de produção (novembro de 2026). Os segredos `GMAIL_USER` e `GMAIL_APP_PASSWORD` são os mesmos do resumo semanal.

### Página própria e imagem de prévia
- Rota `src/app/o/[source]/[id]/`: página com o mesmo conteúdo da gaveta (`DetailContent`), metadados (`generateMetadata`) e imagem 1200×630 (`opengraph-image.tsx`) no visual do hero.
- "Compartilhar" e o evento de agenda apontam para essa página (`opportunityPath` em `src/lib/program-alerts.ts`). Ids com `/` (UNEMAT) viajam com `~`.
- Cache Components: `generateStaticParams` gera os programas e os 40 próximos itens no build (com um exemplo fixo se o banco não estiver configurado); os outros são gerados na primeira visita. `instant = false` porque a página é aberta por link externo e um id inexistente precisa responder 404.
- `metadataBase` em `layout.tsx` usa `NEXT_PUBLIC_SITE_URL` ou `https://topa-estudantes.vercel.app`. Se o domínio mudar, defina a variável na Vercel.

### Auditoria de acessibilidade
Resultado e como repetir em `docs/design/README.md`, seção "Acessibilidade".

## Como foi verificado

`npm test`, `npm run lint`, `npm run typecheck` e `next build`. No navegador (Playwright, Chromium), com um Supabase falso servindo dados de exemplo: computador e celular, temas claro e escuro, com e sem perfil, busca, filtros, aviso, página própria, imagem de prévia e 404. O Safari não estava disponível no ambiente: a correção do `?` segue a causa conhecida e vale conferir num iPhone ou Mac.
