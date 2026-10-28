# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Universitários de qualquer curso no Brasil, com atenção especial a quem está fora do eixo Rio-SP (Centro-Oeste e Norte). Eles procuram oportunidades abertas (hackathons, programas de embaixador, eventos e palestras, bolsas e estágios) e querem saber, antes de abrir o formulário, se podem participar e até quando. Usam o site tanto no celular (chegando por posts no Instagram e links no WhatsApp) quanto no computador, em proporção parecida.

## Product Purpose

Reunir num só lugar as oportunidades abertas para estudantes, hoje espalhadas em dezenas de sites, para que ninguém perca um prazo por não saber que a oportunidade existia (caso real que motivou o projeto: o programa de embaixadores do Gemini fechou antes de o autor saber dele). Sucesso: a pessoa encontra rápido o que serve para ela e chega à página oficial antes do prazo.

## Positioning

- Brasil primeiro, em português, mostrando o que está perto e o que vale a viagem, para além do eixo Rio-SP.
- "Posso participar?": elegibilidade (país, idade, nível, curso) checada antes de a pessoa abrir o formulário.
- Programas recorrentes mostram quando costumam abrir, mesmo fechados.
- O site nunca é a fonte final: cada item leva à página oficial e mostra quando foi verificado.

## Operating Context

- Coleta automática diária (GitHub Actions) de Devpost, MLH e GDGs brasileiros, mais uma lista curada de programas de embaixador conferida à mão e um monitor que avisa quando a página oficial de um programa muda.
- Site público, sem login para consultar. Login por e-mail (Supabase) planejado para salvar perfil e abrir a página já filtrada.
- Divulgação planejada por post semanal no Instagram (@luisx.dev) com oportunidades abertas para estudantes de MT.

## Capabilities and Constraints

- Hoje: listagem de hackathons, eventos de GDG e programas de embaixador; cada item tem tipo, modalidade (online, presencial, híbrido), local, datas ou prazo, benefícios, fonte e data de verificação.
- Planejado (Fase 1): filtros por país, estado, cidade, online/presencial, categoria e prazo; perfil com cidade, raio, categorias de interesse, nível de estudo, curso e se é maior de 18.
- **Curso:** a oportunidade aparece conforme o curso da pessoa. Uma oportunidade restrita a um curso ou área (ex.: jornalismo) só aparece para quem é dessa área; as abertas a qualquer curso aparecem para todos. Hoje as fontes não informam restrição por curso, então nenhum item é escondido por esse critério até o dado existir.
- Modalidade e local são a informação mais importante de cada item, ao lado do prazo e dos benefícios.
- Datas de algumas fontes são só de calendário (sem hora); o site não inventa horários.
- Dados factuais apenas: nada de descrições copiadas nem imagens das fontes.
- Nome e domínio do site ainda não foram definidos.

## Brand Commitments

- Tom próximo, de colega: "você", frases curtas, sem gíria forçada. Urgência só quando o prazo aperta.
- Interface em português; código em inglês.
- README e textos sem emojis.

## Evidence on Hand

- Dados reais coletados das fontes (cerca de 150 itens), com links oficiais.
- Estudo da UNIVASF e TCC da Fatec citados no PLANO.md como evidência do problema.
- Não há depoimentos, números de usuários nem parcerias: não inventar.

## Product Principles

1. A página oficial é sempre o destino; o site resume e aponta, não substitui.
2. Mostrar se a pessoa pode participar antes de mostrar o resto.
3. Nunca afirmar o que não foi conferido: dado incerto aparece marcado como tal.
4. Esconder o que não serve para a pessoa, sem esconder o que serve para todos.

## Accessibility & Inclusion

Público amplo de estudantes, muitos no celular com conexão limitada: páginas leves, texto legível e contraste adequado. Nenhum padrão formal além disso foi definido.
