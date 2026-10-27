# Plano: agregador de oportunidades para estudantes

Atualizado em 27/10/2026 · Luis Felipe

> Para o Claude Code: este arquivo é o plano completo do projeto. Comece pela seção "Fases do projeto", Fase 0. As decisões já tomadas estão marcadas como decididas; não mude sem perguntar.

## Visão geral

Um site público onde qualquer estudante escolhe país, estado e cidade e vê, num só lugar, as oportunidades abertas para ele: hackathons, programas de embaixador, eventos e palestras, bolsas e estágios. Hoje essa informação está espalhada em dezenas de sites, e quem perde o prazo só descobre depois, como aconteceu com o programa do Gemini.

Decisões já tomadas:

- **Público:** site aberto, sem login para consultar.
- **Categorias:** hackathons, embaixador/campus, eventos e palestras, bolsas e estágios.
- **Atualização:** coleta automática em horários fixos.
- **Stack:** JavaScript (Next.js + scripts em Node), com Supabase (banco Postgres + login) desde o MVP.

O diferencial não é só listar: é dizer **se você pode participar** (país, idade, ser estudante, presencial perto ou online) e **até quando**.

## Problema, concorrentes e diferencial

O problema é real: a informação existe, mas está espalhada, e quem mais perde é quem está fora dos grandes centros. Agregadores genéricos já existem aos montes; o que pode funcionar é um recorte bem específico para o Brasil.

Evidências de que o problema existe:

- Na UNIVASF, 162 estudantes de Administração apontaram a falta de conhecimento sobre as atividades como o segundo maior motivo para não participar, atrás só da falta de tempo ([estudo](https://idonline.emnuvens.com.br/id/article/download/327/445/882)).
- Um TCC da Fatec cita a dispersão de informações sobre intercâmbio e as exigências de cada programa como obstáculo ao planejamento ([TCC](https://ric.cps.sp.gov.br/bitstream/123456789/41936/1/informatica_2025_2_beatrizoliveira_desenvolvimentodeumaplataforma.pdf)).
- Experiência própria: o programa de embaixadores do Gemini fechou antes de eu saber que existia.

| Concorrente | O que faz | O que falta |
| --- | --- | --- |
| [Na Prática](https://napratica.org.br/sobre) | Cursos, conteúdo e eventos de carreira; mais de 55 milhões de usuários informados | Não é busca filtrável por cidade, prazo e elegibilidade |
| [dev.events](https://dev.events/meetups/SA/BR) | Conferências e meetups de tecnologia por cidade brasileira | Em inglês; sem embaixadores, bolsas ou editais |
| [Startups.com.br](https://startups.com.br/eventos/calendario-2024-confira-os-feriados-e-eventos-programados-para-o-proximo-ano/) | Curadoria de eventos de inovação | Foco em negócios, não em estudantes |
| [Radar de Oportunidades UFJF](https://www2.ufjf.br/noticias/2025/09/02/ufjf-lanca-plataforma-radar-de-oportunidades/) | Oportunidades da própria universidade | Só serve à comunidade da UFJF |
| Devpost e MLH | Hackathons | Só uma categoria |
| [HackFinder.ai](https://dev.to/anushka_bhardwaj/findhackai-10bl), [Oppura](https://www.producthunt.com/p/oppura/oppura-2) e similares | Agregadores de oportunidades estudantis | Em inglês, foco em Índia e EUA; muitos param no protótipo |

Diferencial do projeto:

1. **Brasil primeiro, fora do eixo Rio-SP:** português, foco em quem está no Centro-Oeste e no Norte, mostrando o que está perto e o que vale a viagem.
2. **"Posso participar?":** checagem de elegibilidade (país, idade, nível) antes de a pessoa abrir o formulário.
3. **Calendário de programas recorrentes:** "costuma abrir em julho, quer lembrete?" para programas anuais como Gemini, GitHub e Claude.
4. **Editais locais das universidades:** iniciação científica, monitoria e extensão que hoje estão em PDFs. É trabalhoso, e por isso difícil de copiar.
5. **Comunidade enviando oportunidades:** atléticas, centros acadêmicos e GDGs divulgam seus eventos no site.

O maior risco não é técnico: é manter os dados certos toda semana. Por isso, validar antes de construir tudo:

- [ ] Perguntar a 30 ou 40 colegas da UFMT se já perderam alguma oportunidade por não saber dela e onde procuram hoje.
- [ ] Publicar no Instagram (@luisx.dev) um post semanal com "oportunidades abertas para estudantes de MT" e medir salvamentos e compartilhamentos.

## Fontes de dados verificadas

A maioria das plataformas de eventos não tem API pública de busca, então a coleta vai misturar três jeitos: API/JSON público, leitura da página (raspagem) e lista curada. Checado em 27/10/2026.

| Fonte | Categoria | Como acessar | Situação |
| --- | --- | --- | --- |
| Devpost | Hackathons (global, online) | JSON público em devpost.com/api/hackathons, o mesmo que o site usa, sem chave | Não oficial: pode mudar sem aviso |
| MLH | Hackathons estudantis | Página do calendário da temporada (mlh.io/events) | Sem API: raspagem |
| GDG / Bevy | Eventos, DevFest, GDG on Campus | API pública em /api; algumas rotas exigem chave. Também há sitemaps de eventos | Testar quais rotas abrem sem chave |
| dev.events | Conferências e meetups por cidade | Páginas já filtradas por país e cidade | Sem API conhecida: raspagem |
| Sympla | Eventos no Brasil | API só lista eventos do próprio organizador (token) | Busca pública só por raspagem |
| Even3 | Eventos acadêmicos | API só para eventos do próprio organizador | Busca pública só por raspagem |
| Eventbrite | Eventos | Busca pública desligada em fev/2020 | Fora do MVP |
| Meetup | Meetups | API para clientes Pro | Fora do MVP |
| Luma | Eventos de tech/IA | API por calendário, exige Luma Plus | Só calendários conhecidos, via página pública |
| Unstop | Hackathons (foco Índia) | JSON público, sem chave; não valida filtros | Baixa prioridade para o Brasil |
| Programas de embaixador | Embaixador/campus | Páginas oficiais (Google, Microsoft, GitHub, AWS, Anthropic, Notion etc.) | Lista curada + monitor de mudança na página |
| Bolsas e estágios | Bolsas e estágios | Editais de universidades, CNPq/CAPES, agentes de integração | Fontes muito variadas: fase posterior |

Conclusão: dá para começar com Devpost, MLH, GDG e a lista curada de embaixadores. Sympla e dev.events entram depois para eventos locais no Brasil.

## Arquitetura

No MVP tudo roda sem servidor próprio: o GitHub Actions faz a coleta uma vez por dia, o resultado é gravado no Supabase e a Vercel publica o site.

Fluxo:

1. **Fontes:** APIs e JSON públicos (Devpost, GDG/Bevy), raspagem de páginas (MLH, dev.events, Sympla) e lista curada em YAML (programas de embaixador, com monitor que avisa quando a página muda).
2. **Coletores em Node:** rodam pelo GitHub Actions uma vez por dia; no máximo 1 requisição por segundo por site.
3. **Normalização:** converte para o esquema único (Zod), geocodifica o endereço e deduplica entre fontes. Coleta com falha mantém os dados anteriores.
4. **Revisão manual:** dados extraídos por IA e páginas de programa que mudaram só são publicados depois de conferidos.
5. **Dados:** Supabase com oportunidades, perfis e login por e-mail.
6. **Site Next.js na Vercel:** filtra por país, cidade, raio, categoria e prazo; cada card leva ao link oficial e mostra a data de verificação.

Custos esperados no MVP:

- **GitHub Actions e repositório público:** gratuitos.
- **Vercel (plano Hobby):** gratuito para projeto pessoal, sem fins comerciais.
- **Supabase (desde o MVP):** plano gratuito, suficiente para começar (projetos gratuitos pausam após uma semana sem atividade).
- **IA para extrair dados de editais (opcional):** cobrada por uso; só entra na fase 3.

## Modelo de dados e filtro por localidade

Toda fonte é convertida para o mesmo formato de "oportunidade".

| Campo | Exemplo | Para que serve |
| --- | --- | --- |
| tipo | hackathon, embaixador, evento, bolsa, estagio | Filtro por categoria |
| titulo, organizador | Programa de Embaixadores Estudantis, Google | Exibição |
| url_oficial | link da página oficial | Sempre o destino final; nunca só o agregador |
| modalidade | presencial, online, hibrido | Decide se a distância importa |
| local | cidade, estado, país, lat, lng | Filtro por localidade e raio |
| inicio, fim | 2026-11-10 | Datas do evento ou programa |
| prazo_inscricao | 2026-11-05 | Ordenação padrão: o que fecha primeiro |
| elegibilidade | países aceitos, idade mínima, só estudantes, nível | Responde "posso participar?" |
| custo, beneficio | gratuito, R$ 50; prêmio, bolsa, certificado | Exibição e filtro |
| porte | local, regional, nacional | Destaque de eventos grandes |
| fonte, id_fonte | devpost, 12345 | Deduplicação e rastreio |
| verificado_em | 2026-10-27 | Mostra quando a informação foi checada |
| status | aberta, em_breve, encerrada | Esconde o que já fechou |

Como o filtro decide o que aparece para quem mora em Várzea Grande (MT):

1. **Online:** aparece se a elegibilidade aceita o Brasil.
2. **Presencial ou híbrido:** sempre aparece. O que está dentro do raio (padrão: 100 km) vem primeiro, em "Perto de você"; o resto aparece abaixo, ordenado por distância. Eventos grandes (porte nacional), como um congresso da SBC em Manaus, ganham a etiqueta "Evento nacional" e uma seção própria.
3. **Elegibilidade:** some se exigir outro país, outra idade ou outro nível (por exemplo, "só faculdades dos EUA").
4. **Prazo:** encerradas ficam escondidas, mas podem aparecer com a etiqueta "abre de novo em" quando o programa é anual.

Para o raio funcionar, cada endereço vira latitude e longitude (geocodificação). O Nominatim, do OpenStreetMap, é gratuito, mas limita a uma requisição por segundo, então os resultados ficam em cache.

Com login, a pessoa salva no perfil cidade, raio, categorias de interesse, nível de estudo e se é maior de 18 anos. O filtro passa a rodar sozinho com esses valores. O perfil guarda só o necessário para filtrar: nada de CPF, telefone ou endereço completo.

## Como garantir informação correta

O site nunca é a fonte final. Cada card mostra o link oficial e a data em que foi checado.

- **Link oficial sempre:** o botão principal leva à página do organizador.
- **"Verificado em":** cada item mostra a data da última coleta. Item que some da fonte em duas coletas seguidas vira encerrado.
- **Deduplicação:** dois itens são o mesmo quando título normalizado, data de início e cidade batem; o site mantém um e lista as duas fontes.
- **Programas de embaixador:** ficam num arquivo curado (YAML) com país aceito, período típico de inscrição e link. Um robô baixa a página oficial todo dia e avisa quando o texto muda, para revisão antes de publicar.
- **Páginas sem estrutura (editais):** IA pode extrair datas e requisitos, mas o resultado entra como "não revisado" até uma pessoa confirmar.
- **Fuso horário:** prazos em UTC com o fuso da fonte; o site mostra no horário do usuário (Cuiabá é UTC-4).
- **Botão "reportar erro"** em cada card.

## Fases do projeto

1. **Fase 0: base (1 semana)**
   - Repositório no GitHub, projeto Next.js (App Router, TypeScript, Tailwind) e deploy na Vercel.
   - Esquema da oportunidade validado com Zod.
   - Projeto no Supabase com as tabelas opportunities e profiles (RLS para cada pessoa ver só o próprio perfil).
   - Primeiro coletor: Devpost, gravando no Supabase, com teste usando uma resposta salva.
   - Entrega: página que lista hackathons abertos do Devpost, ordenados pelo prazo, com link oficial.
2. **Fase 1: MVP (2 a 3 semanas)**
   - Coletores de MLH e GDG/Bevy.
   - Arquivo curado com cerca de 10 programas de embaixador e monitor de mudança nas páginas.
   - Filtros: país, estado, cidade, online, categoria, prazo. Login por e-mail (Supabase Auth): a página inicial abre filtrada pelo perfil.
   - Coleta diária pelo GitHub Actions.
   - Entrega: site público com as três fontes, embaixadores e login com perfil.
3. **Fase 2: eventos locais no Brasil (3 a 4 semanas)**
   - Coletores de Sympla (categoria tecnologia) e dev.events.
   - Geocodificação e filtro por raio.
   - Deduplicação entre fontes e botão "reportar erro".
   - Alertas por e-mail: "novas oportunidades perto de você".
4. **Fase 3: bolsas e estágios (decidido: fica nesta fase)**
   - Editais da UFMT e de outras universidades, chamadas do CNPq/CAPES.
   - Extração assistida por IA com fila de revisão.
   - Favoritos e lembretes de prazo por e-mail para quem tem conta.

## Riscos e cuidados

- **Coletor quebrado:** cada coletor tem teste com uma resposta salva; se a coleta vier vazia ou com erro, o GitHub Actions falha e avisa, e o site mantém os dados anteriores.
- **Termos de uso:** ler o robots.txt e os termos de cada site antes de raspar; preferir API ou JSON público; no máximo uma requisição por segundo por site; User-Agent identificando o robô com contato.
- **Direitos autorais:** guardar só dados factuais (nome, data, local, link) e um resumo próprio; nunca copiar descrição inteira nem imagens.
- **LGPD:** com login, o site guarda e-mail e preferências. Precisa de política de privacidade, consentimento no cadastro, opção de apagar a conta e RLS no Supabase.

Decisões em aberto:

- Nome e domínio do site.
- Quantos programas de embaixador entram na lista inicial.

## Convenções do repositório

- README em português, direto, sem emojis e sem texto genérico.
- Código e nomes de variáveis em inglês; textos da interface em português.

## Próximos passos

- [x] Criar o repositório no GitHub: [LuisFelipeGon-dev/gerenciador-oportunidades](https://github.com/LuisFelipeGon-dev/gerenciador-oportunidades). O nome ainda é provisório.
- [x] Criar o projeto Next.js e fazer o primeiro deploy na Vercel ([gerenciador-oportunidades.vercel.app](https://gerenciador-oportunidades.vercel.app)); criar o projeto no Supabase e ativar o login por e-mail.
- [x] Escrever o esquema da oportunidade em TypeScript + Zod.
- [x] Testar o JSON do Devpost e escrever o primeiro coletor.
- [ ] Escolher o nome definitivo do projeto.
- [ ] Testar quais rotas da API do Bevy (GDG) respondem sem chave.
- [ ] Montar o YAML inicial de programas de embaixador (Gemini, Microsoft, GitHub, AWS, Claude, Notion).
- [x] Configurar o GitHub Actions para rodar a coleta uma vez por dia (09:17 UTC).
