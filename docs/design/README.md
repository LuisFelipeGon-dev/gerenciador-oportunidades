# Visual do Topa? (identidade "Silício")

Guia para quem mexe na interface, gente ou agente. Antes de criar componente novo, procure aqui e em `src/app/_components/`: quase tudo já existe.

Referência que originou o visual: o protótipo "Topa? Oportunidades para estudantes" (artifact do claude.ai, novembro de 2026). As telas reais e a lista de melhorias ficam no artifact "Topa? Redesenho".

## Ideia em uma frase

Fundo de ardósia (azul quase preto no escuro, azul-gelo no claro), um azul de sinal como única cor de destaque, um verde-água só para o "ponto" do `?`, cantos quase retos e títulos em fonte monoespaçada. A personalidade vem do `?` desenhado em pixels e da grade fina que acende sob o mouse.

## Onde está cada coisa

| O quê | Onde |
| --- | --- |
| Cores (claro e escuro), raios, animações, padrões reutilizáveis | `src/app/globals.css` |
| Fontes (Sora no texto, Geist Mono em títulos, datas e botões) | `src/app/layout.tsx` (`next/font/google`) |
| Logo, `?` em pixels, `?` em matriz de pontos, cabeçalho das páginas internas, rodapé | `src/app/_components/brand.tsx` |
| Botão de tema | `src/app/_components/theme-toggle.tsx` |
| Cartões, linhas, selo "Combina com você", faixa de prêmio, botões Salvar, Página oficial e "Me avise quando abrir" | `src/app/_components/cards.tsx` |
| Painel e faixa de próximos prazos | `src/app/_components/deadline-panel.tsx` |
| Campos de formulário: lista (`Select`), texto com sugestões (`Combobox`), data DD/MM/AAAA (`DateField`) e a classe `fieldClass` | `src/app/_components/fields.tsx` |
| Conteúdo de uma oportunidade (gaveta da home e página própria) | `src/app/_components/detail-drawer.tsx` (`DetailContent`) |
| Página própria e imagem de prévia | `src/app/o/[source]/[id]/` |
| Ícone do site | `src/app/icon.svg` |

## Cores

Sempre pelos tokens (classes Tailwind geradas em `@theme inline`): `bg-ground`, `bg-card`, `bg-card-2`, `text-ink`, `text-ink-2`, `text-muted`, `border-line`, `border-line-strong`, `text-action`, `bg-sky-tint`, `bg-btn`/`text-on-btn`, `text-urgent`/`bg-urgent-bg`, `text-open`, cores por tipo (`hack`, `event`, `prog`) e `--cal-*` da agenda.

- Nunca escreva hex num componente: o tema escuro não vai acompanhar. Se faltar um tom, crie o token nos três blocos de `globals.css` (`:root`, `[data-theme="dark"]` e a media query).
- `action` (azul) é para links, foco, estado selecionado e números de destaque. O botão principal usa `btn`, que é neutro (azul-marinho no claro, quase branco no escuro).
- Vermelho (`urgent`) só para prazo em até 7 dias e requisito que falta. Verde (`open`) só para "pode participar" e "inscrições abertas".

## Tipografia

- Títulos de seção, de cartão e da gaveta, botões, chips, abas, datas e números: `font-mono` com `tracking-[-0.045em]` (títulos) ou `tracking-tight` (botões).
- Texto corrido: Sora (`font-sans`, padrão do `body`).

## Padrões prontos (`globals.css`, `@layer components`)

- `grid-bg`: a grade fina que esmaece para baixo. Coloque em superfícies de destaque (hero, cartões, painéis).
- `spot`: luz que segue o mouse (halo e grade acesa). Precisa de `position: relative` (já vem com `grid-bg`). O hero usa também `spot-lg`, maior. Quem define `--mx`/`--my` é o `pointermove` em `home.tsx`; uma página nova sem a home precisa do mesmo listener.
- `stack`: cartões colados, separados por uma linha de 1px.
- `sec-rule`: linha em degradê sob o título de seção (cresce ao rolar).
- `reveal`: a seção sobe ao entrar na tela (animação ligada à rolagem, só em CSS).
- `type-cursor`: cursor piscando depois do título do hero.
- `matrix`: o `?` em pontos do hero (`MatrixMark`). Os pontos acendem em onda e crescem sob o mouse.
- `check`: caixa de marcar e rádio desenhados pelo site (`<input type="checkbox" className="check">`).

## Formulários

Nada de controle nativo do navegador: `<select>`, `<datalist>` e `type="date"` mudam de cara em cada navegador e ignoram o tema. Use os componentes de `fields.tsx` e a classe `check`. Os formulários usam `noValidate` e conferem os campos no `submit`, para a mensagem de erro ser a do site (caixa `role="alert"` com `bg-urgent-bg`), não o balão do navegador. As listas abrem para cima quando falta espaço embaixo e Esc fecha só a lista, não a janela.

## Animação: regras que já causaram bug

1. **Não use `var()` dentro de `@keyframes` para cor.** O Safari não resolve e pinta SVG de preto; foi isso que sumiu com o `?` no tema escuro. Anime só `opacity`, `transform` e valores fixos; a cor fica na regra normal.
2. **Use `animation-fill-mode: backwards`** quando o estado final da animação é igual ao estilo normal. Com `both`, a animação "segura" o `transform` e o hover não funciona.
3. **O Lightning CSS (compilador do Tailwind) apaga `pointer-events: auto`** em regras próprias. Para SVG use `visiblePainted`.
4. Todo movimento respeita `prefers-reduced-motion` (bloco no fim de `globals.css`; `HeroTitle` e `CountUp` checam também no JavaScript).
5. Seletores de hover do logo não usam `>`: o `?` fica dentro de um `span`.

## Acessibilidade (auditoria de novembro de 2026)

axe-core 4.10 (WCAG 2.1 A e AA + boas práticas) em 9 telas, 2 temas e 2 larguras (1360 e 390): nenhuma violação depois de corrigir a ordem de títulos da página própria. Teclado: todo item tem contorno visível, a gaveta prende o foco e fecha com Esc, "/" e Ctrl+K levam à busca, o link "Ir para o conteúdo" é o primeiro da página.

Ao mexer na interface, mantenha:

- alvos de toque com pelo menos 40px (botões usam `h-10`/`h-11`);
- títulos em ordem (`h1` da página, `h2` das seções, `h3` dos cartões); `DetailContent` recebe `titleAs` para isso;
- contraste dos tokens: não clareie `muted` nem escureça `line-strong` sem rodar o axe de novo;
- todo controle com nome acessível (`aria-label` quando só há ícone).

Para repetir a auditoria: suba o site (`npm run build && npm start` com o Supabase configurado), injete `axe-core` com Playwright em cada tela e rode `axe.run` com as tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`.

## Divergências conhecidas

- O e-mail do resumo semanal (`src/lib/digest-email.ts`) ainda usa as cores e a fonte da identidade anterior (azul-marinho e Figtree).
- `identidade/` guarda os arquivos da identidade anterior; o logo do site agora é desenhado em `brand.tsx`.
