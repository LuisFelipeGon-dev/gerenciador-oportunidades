Quero melhorar o visual e a qualidade do site Topa? seguindo a nossa identidade visual. Trabalhe nesta ordem.

## 1. Leia antes de mexer
- `identidade/IDENTIDADE.md`, `identidade/tokens.json` e os logos em `identidade/`. Essa é a identidade oficial: nome "Topa?", azul-marinho e azul-céu, fonte Figtree, tema claro e escuro.
- `src/app/globals.css`, `src/app/_components/home.tsx` e `cards.tsx` para ver o estado atual.
- A identidade manda. As skills de design abaixo não podem trocar paleta, fonte nem nome. Elas servem para executar bem dentro dela.

## 2. Preparação
- Mova `skills-baixadas/web-design-guidelines` e `skills-baixadas/frontend-design` para `.claude/skills/`.
- Se o MCP do Chrome DevTools não estiver instalado, me diga o comando (`claude mcp add chrome-devtools -- npx chrome-devtools-mcp@latest`) e espere eu rodar. Não instale shadcn nem 21st.dev: o projeto usa Tailwind direto e não quero depender de outra biblioteca de componentes.

## 3. Aplicar a marca (se ainda não foi feito)
Siga a seção "O que aplicar no projeto" de `identidade/IDENTIDADE.md`: nome, logotipo no topo, favicon, título e metadados.

## 4. Auditar
- Rode a skill `web-design-guidelines` em `src/app/**/*.tsx` e `src/app/globals.css`.
- Abra o site local com o Chrome DevTools MCP e tire capturas da home, da gaveta de detalhes, do perfil e da tela de entrar, em celular (390px) e desktop, nos temas claro e escuro. Liste o que está errado antes de corrigir: contraste, foco por teclado, alvos de toque pequenos, quebra de layout, estados vazios e de erro, textos cortados.

## 5. Melhorar
Use a skill `frontend-design` para decidir as melhorias, com estas regras:
- Hierarquia e ritmo: título da home, espaçamento entre seções e cartões em múltiplos de 4, `radius-lg` nos cartões, `radius-pill` nos selos de prazo.
- Os cartões de oportunidade devem mostrar primeiro o que importa para decidir: tipo, nome, prazo de inscrição, onde e se dá para participar. O prazo perto de fechar tem de se destacar.
- Texto: português do Brasil, "você", frases curtas, verbos nos botões ("Ver programa", "Salvar"), sem emojis, sem exclamações e sem frases genéricas de startup.
- Cor: `action` é a única cor de clique. `sky` nunca é texto sobre fundo claro. Contraste mínimo de 4,5:1 em texto, nos dois temas.
- Movimento: pouco e só quando responde a uma ação (abrir a gaveta, salvar). Respeitar "reduzir movimento".
- Evite o visual de template: nada de gradiente azul-roxo, nada de cartões idênticos com sombra cinza, nada de rótulos em caixa alta sobre cada título.
- Acessibilidade: foco visível por teclado, `alt` nas imagens, botões com nome, formulários com rótulo.

## 6. Não mexer
Lógica de dados, Supabase, coletores, regras de elegibilidade, rotas e nomes de tabelas.

## 7. Conferir
- Rode `npm run build` e o lint.
- Rode de novo `web-design-guidelines` e confirme que os problemas encontrados sumiram.
- Tire capturas novas com o Chrome DevTools MCP nos mesmos tamanhos e temas e compare com as de antes.
- Faça commits pequenos, um por assunto (marca, contraste, cartões, acessibilidade), em português e sem emojis. Não faça push: eu reviso primeiro.

No final, me diga em poucas linhas o que mudou, o que ficou de fora e qualquer decisão de design que eu deva aprovar.
