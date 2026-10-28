# Identidade visual do Topa?

O site passa a se chamar **Topa?** (antes "oportunidades"). Escreva sempre assim: T maiúsculo e ponto de interrogação. O nome é um convite: "Hackathon em Cuiabá. Topa?".

Subtítulo da marca: "Eventos, hackathons, programas e bolsas pra estudantes."

## Arquivos desta pasta

- `topa-wordmark.svg`: logotipo para fundo claro (Topa em azul-marinho, ? em #0970ad).
- `topa-wordmark-dark.svg`: logotipo para fundo escuro e para a faixa azul-marinho do topo (Topa em branco, ? em azul-céu).
- `topa-mark.svg`: marca quadrada (fundo #0c2a66, ? branco, ponto azul-céu). Serve de favicon e avatar.
- `topa-mark-sky.svg`: marca quadrada sobre azul-céu, para fundos escuros.
- `topa-app-icon.svg`: marca sem cantos arredondados, para ícone de app/PWA.
- `*.png`: previews das mesmas imagens.
- `tokens.json`: cores (claro e escuro), tipografia, espaços e raios da marca.

## O que aplicar no projeto

1. Copie os SVGs para `public/brand/` e use `topa-mark.svg` como favicon (`src/app/icon.svg`).
2. `src/app/layout.tsx`: título "Topa? Eventos, hackathons e programas pra estudantes" e descrição com o novo nome. Use `title.template` com "%s | Topa?".
3. `src/app/_components/home.tsx`, link do logo no topo (por volta da linha 213): troque o quadrado azul-céu com círculo e o texto "oportunidades" por `<img src="/brand/topa-wordmark-dark.svg" alt="Topa?" className="h-7 w-auto" />`, mantendo o `Link` e o `onClick`.
4. Troque qualquer outra ocorrência de "oportunidades" que seja o nome do site (rodapé, ajustes, texto do hero). Não mude nomes de tabelas, rotas nem tipos.
5. `src/lib/theme.ts`: a chave do localStorage `oportunidades:tema:v1` pode virar `topa:tema:v1`. Se mudar, leia a chave antiga como fallback para não perder a escolha de quem já usa.
6. README: título "Topa?", sem emojis e sem texto genérico.
7. Cores: o azul-marinho e o azul-céu atuais continuam. Ajustes: `action` #0970ad no claro (links, botão principal, anel de foco) e #5cc8ff no escuro; `sky` nunca como texto sobre fundo claro. Os valores completos estão em `tokens.json`. Compare com `src/app/globals.css` e só altere o que divergir.

Fonte: Figtree, que já está no projeto. Não troque.
