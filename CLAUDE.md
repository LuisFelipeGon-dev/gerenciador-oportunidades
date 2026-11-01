@AGENTS.md

# Topa?

Site público que reúne oportunidades para estudantes (hackathons, eventos, programas, bolsas). Produto e público: `PRODUCT.md`. Plano: `PLANO.md`. Como rodar e as fontes de dados: `README.md`.

## Antes de mexer na interface

Leia `docs/design/README.md`: tokens de cor, fontes, componentes prontos, padrões de animação e as regras que já causaram bug (sem `var()` em `@keyframes`, `fill-mode: backwards`, `pointer-events` em SVG). O que mudou na última rodada está em `docs/design/melhorias-2026-11.md`.

## Convenções

- Interface em português, de colega para colega ("você", frases curtas). Código, nomes e comentários em inglês. Sem emojis.
- A página oficial é sempre o destino; nunca afirmar o que não foi conferido.
- Cores só pelos tokens de `src/app/globals.css`; nada de hex em componente.
- Lógica pura em `src/lib/` com teste ao lado (`*.test.ts`, Vitest). Componentes em `src/app/_components/`.
- Banco: uma migração nova por mudança em `supabase/migrations/`, com RLS.

## Antes de entregar

```bash
npm test
```

```bash
npm run lint
```

```bash
npm run typecheck
```

Mudança visual: confira no navegador, nos temas claro e escuro, no computador e no celular (390px).
