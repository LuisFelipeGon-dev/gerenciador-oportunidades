# Alertas por e-mail: design

28/10/2026 · aprovado na conversa, falta revisão desta especificação

## Objetivo

Um resumo por e-mail, uma vez por semana, para quem tem conta e pediu: o que entrou de novo e serve para o perfil, e os prazos dos itens salvos que fecham nos próximos 7 dias. É o último item da Fase 2 do PLANO ("Alertas por e-mail: novas oportunidades perto de você").

Sucesso: a pessoa recebe toda segunda só o que serve para ela, chega à página do item antes do prazo e consegue parar de receber com um clique.

## Decisões

| Ponto | Decisão |
| --- | --- |
| Envio | Gmail via SMTP com senha de app (`nodemailer`). Sem domínio próprio por enquanto. Limite do Gmail: cerca de 500 e-mails por dia. |
| Frequência | Semanal, segunda de manhã. Só envia se houver algo. |
| Quem recebe | Só contas (e-mail já confirmado no login) que ligaram o alerta. Começa desligado. |
| Onde roda | GitHub Actions, workflow agendado próprio, com um script Node como a coleta. |

## Dados (migração 0007)

Na tabela `profiles`:

- `alerts_enabled boolean not null default false`
- `alerts_enabled_at timestamptz`: quando a pessoa ligou (registro do consentimento).
- `alerts_token uuid not null default gen_random_uuid()`: identifica o link "parar de receber". Não é segredo de login; só desliga o alerta.
- `alerts_last_sent_at timestamptz`: último envio feito com sucesso.

Função `public.unsubscribe_alerts(token uuid)`, `security definer`, executável por `anon`: põe `alerts_enabled = false` no perfil com esse token e retorna se achou. O RLS atual continua valendo para o resto.

A pessoa liga e desliga pelo próprio perfil (RLS de dono, como hoje). `alerts_token` e `alerts_last_sent_at` não são alterados pelo navegador.

## Interface

- **Formulário de perfil**, só com sessão: caixa desmarcada "Quero um resumo por e-mail toda segunda com o que serve pra mim", com uma linha dizendo para qual e-mail vai. Marcar grava `alerts_enabled` e `alerts_enabled_at`. Sem sessão: uma linha convidando a entrar para receber o resumo.
- **`/alertas/cancelar?t=<token>`**: página simples que chama `unsubscribe_alerts` e confirma "Pronto, você não vai mais receber o resumo", com link para religar no perfil. Token inválido: mensagem neutra, sem dizer se o token existe.
- **Política de privacidade**: parágrafo sobre o alerta (o que é enviado, por qual endereço, como parar) e nova data de versão; `PRIVACY_VERSION` atualizada. Como o alerta só liga com a caixa marcada, não há aviso de re-consentimento.

## Conteúdo do e-mail

Selecionado por uma função pura, `buildDigest`, a partir de perfil, itens abertos (já deduplicados), programas, salvos, data de hoje, posição da cidade e data do último envio:

1. **Novidades pra você**: itens com `created_at` depois do último envio (no primeiro envio, os últimos 7 dias) que passam pelos mesmos filtros do site: interesses efetivos, elegibilidade (`isExcluded`), online ou presencial dentro do raio (no estado quando a cidade não tem coordenadas). Ordem: o que fecha primeiro. No máximo 10, com "e mais N no site".
2. **Prazos dos seus salvos**: salvos com prazo (ou início) entre hoje e 7 dias.
3. Os dois vazios: o e-mail não é enviado.

Cada item: título, tipo, "fecha em DD/MM" ou "acontece em DD/MM", local ou "online" (com distância quando houver), benefício principal e link para `SITE_URL/#o=<item>`.

Assunto: "3 oportunidades pra você e 2 prazos esta semana" (singular e plural tratados; só uma das partes quando a outra é zero).

HTML simples com estilos inline (clientes de e-mail ignoram CSS externo), largura máxima de 600 px, cores do tema claro, e versão em texto puro. Rodapé: "Ajustar perfil" (link para o site) e "Parar de receber" (link com o token), mais uma linha dizendo por que a pessoa recebe.

## Envio (`scripts/alerts.ts`)

1. Com a chave de serviço: perfis com `alerts_enabled`, os e-mails pelo Auth (`auth.admin`), os salvos de cada um, as oportunidades abertas e os programas.
2. Posição da cidade pelo `data/municipios.json` (mesma função do site).
3. Para cada perfil: `buildDigest`; vazio, pula; senão envia pelo Gmail, no máximo 1 por segundo, e grava `alerts_last_sent_at`.
4. Falha num envio: registra, segue com os outros e no fim sai com erro para o GitHub avisar. Quem falhou não tem a data atualizada e entra no próximo envio.
5. `--dry-run`: não envia nem grava; escreve o HTML de cada e-mail em `alerts-preview/` e lista quem receberia.
6. `--to=<email>`: envia só para esse endereço (teste real com o próprio e-mail).

Workflow `.github/workflows/alerts.yml`: segunda às 11:00 UTC (07:00 em Cuiabá), mais disparo manual; roda os testes antes. Segredos novos: `GMAIL_USER`, `GMAIL_APP_PASSWORD`. Usa também `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, que já existem.

## Testes

- `buildDigest`: novo desde o último envio, primeiro envio (7 dias), filtros de interesse, elegibilidade e raio, limite de 10 com contagem do resto, salvos que fecham em até 7 dias, resultado vazio.
- Assunto: singular, plural, só novidades, só prazos.
- HTML e texto: itens presentes, links com o item, link de cancelar com o token, título escapado (sem injeção de HTML).
- Página de cancelamento: token válido e inválido (a função do banco, testada manualmente na migração).

## Fora deste passo

- Escolher a frequência (diário, semanal) e as categorias do alerta separadas do perfil.
- Domínio próprio e outro provedor de envio.
- Lembrete de prazo no dia (Fase 3).

## Riscos

- **Entregabilidade:** e-mails de um Gmail pessoal podem cair em promoções ou spam. Mitigação: texto simples, poucos links, remetente com nome do projeto. A troca para domínio próprio fica registrada no PLANO.
- **Senha de app:** fica só nos segredos do GitHub; nunca no repositório nem no `.env` commitado.
- **LGPD:** o alerta usa só o e-mail e o perfil que a pessoa já deu; liga só com consentimento explícito; desliga com um clique; nada é compartilhado com terceiros além do envio pelo Google.
