import { z } from "zod";
import { firstSentence, parseInscriptionPeriod, parseStipend, parseSummary } from "../lib/edital-text";
import { campusCity, campusFromText, INSTITUTIONS } from "../lib/institutions";
import { opportunitySchema, type Opportunity } from "../lib/opportunity";
import type { Level } from "../lib/personalize";
import { politeFetchJson, type FetchJson } from "./http";
import { extractText } from "./page-monitor";

// IFMT calls for proposals (editais) for students, from the public WordPress API of ifmt.edu.br
// (robots.txt allows everything, checked 2026-10-29). Each post is tagged with its audience and
// campus. The PDFs sit on Google Drive, whose robots.txt forbids automated downloads, so only
// the text of the post is read.

const API_URL = "https://ifmt.edu.br/wp-json/wp/v2/edital";
const PER_PAGE = 100;
const MAX_PAGES = 3;
const RECENT_DAYS = 60;
/** Without a deadline in the text, a call is kept this long: IFMT selections take a few weeks. */
const UNDATED_DAYS = 30;
/** More units than this: a call for the whole institute, not for one campus. */
const MAX_UNITS = 3;
const REITORIA = "Reitoria";

const postSchema = z.object({
  id: z.number(),
  date: z.string(),
  link: z.string().url(),
  title: z.object({ rendered: z.string() }),
  content: z.object({ rendered: z.string() }),
  // WordPress sends an array, or an object when classes were filtered out.
  class_list: z.union([z.array(z.string()), z.record(z.string(), z.string())]).transform((c) => (Array.isArray(c) ? c : Object.values(c))),
});
export type IfmtPost = z.infer<typeof postSchema>;

export function parseIfmtPage(json: unknown): IfmtPost[] {
  return z.array(postSchema).parse(json);
}

const LEVELS: Record<string, Level[]> = {
  "estudante-medio": ["high_school"],
  "estudante-superior": ["undergraduate"],
  "estudante-pos-graduacao": ["graduate", "phd"],
};
const AREAS: Record<string, string> = {
  "assistencia-estudantil-inclusao-e-diversidade": "Assistência estudantil",
  estagio: "Estágio",
  extensao: "Extensão",
  pesquisa: "Pesquisa",
  ensino: "Ensino",
};
const slug = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** "unidade-edital-<slug>" -> campus name. */
const UNIT_BY_SLUG = new Map<string, string>([
  ["rtr", REITORIA],
  ...INSTITUTIONS.IFMT.flatMap((c) => [c.name, ...(c.aliases ?? [])].map((n) => [slug(n), c.name] as [string, string])),
]);

/** What the classes of a post say: the student levels, the units (campuses) and the area. */
export function ifmtTerms(classList: string[]) {
  const levels: Level[] = [];
  const units: string[] = [];
  let area: string | null = null;
  for (const cls of classList) {
    const audience = /^publico-alvo-edital-(.+)$/.exec(cls)?.[1];
    if (audience && LEVELS[audience]) levels.push(...LEVELS[audience]);
    const unit = /^unidade-edital-(.+)$/.exec(cls)?.[1];
    const name = unit && UNIT_BY_SLUG.get(unit);
    if (name && !units.includes(name)) units.push(name);
    const areaSlug = /^area-edital-(.+)$/.exec(cls)?.[1];
    if (!area && areaSlug && AREAS[areaSlug]) area = AREAS[areaSlug];
  }
  return { levels, units, internship: classList.includes("area-edital-estagio"), area };
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const NOT_FOR_STUDENTS = /docente|professor|servidor|tecnico[s]?[- ]administrativ|tutor|resultado|retifica|homologa|complementar|eleicao|errata/;
/** For posts without audience tags: the title must say it is for students. */
const FOR_STUDENTS = /bolsist|estudante|aluno|discente|monitori|auxilio|estagi/;

const FINISHED = /resultado final|resultado definitivo/i;
/**
 * A sentence that says what the call is: not a list of links ("Resultado Preliminar Link de
 * Inscrição") nor the formal opening ("O DIRETOR-GERAL …, no uso de suas atribuições").
 */
const DESCRIBES = /selecion|sele[cç][aã]o|objetivo|inscri[cç][oõ]es abertas|\babre\b|torna p[uú]blic/i;
const NOT_A_DESCRIPTION = /resultado|deferid|retifica|acesse|clique|link|atribui/i;

function describe(text: string): string | null {
  const sentence = text.split(/(?<=[.!?])\s+(?=\p{Lu})/u).find((s) => DESCRIBES.test(s) && !NOT_A_DESCRIPTION.test(s));
  return sentence ? firstSentence(sentence) : null;
}

export function mapIfmtEdital(post: IfmtPost, verifiedAt: string): Opportunity | null {
  const title = extractText(post.title.rendered).replace(/\s+/g, " ");
  const t = fold(title);
  if (NOT_FOR_STUDENTS.test(t)) return null;
  const { levels, units, internship, area } = ifmtTerms(post.class_list);
  const tagged = post.class_list.some((c) => c.startsWith("publico-alvo-edital-"));
  if (!levels.length && (tagged || !FOR_STUDENTS.test(t))) return null;

  const text = extractText(post.content.rendered).replace(/\s+/g, " ");
  // The post is updated with each stage: a final result means the selection is over.
  if (FINISHED.test(text)) return null;
  const period = parseInscriptionPeriod(`${title}. ${text}`);
  if (period && period.end < verifiedAt.slice(0, 10)) return null;

  // Without unit tags, the campus the title or the text names ("… do IFMT Campus Várzea Grande …").
  const named = campusFromText("IFMT", title) ?? campusFromText("IFMT", text);
  const campuses =
    units.includes(REITORIA) || units.length > MAX_UNITS ? null : units.length ? units : named ? [named] : null;
  const campus = campuses?.length === 1 ? campuses[0] : null;
  const stipend = parseStipend(text);

  return opportunitySchema.parse({
    type: internship ? "internship" : "scholarship",
    title,
    organizer: campus ? `IFMT · ${campus}` : "IFMT",
    officialUrl: post.link,
    modality: "in_person",
    location: {
      raw: campus ? `IFMT, câmpus ${campus}` : "IFMT",
      city: (campus && campusCity("IFMT", campus)) ?? "Cuiabá",
      state: "MT",
      country: "BR",
      lat: null,
      lng: null,
    },
    startsOn: null,
    endsOn: null,
    registrationDeadline: period?.end ?? null,
    eligibility: {
      countries: null,
      minAge: null,
      studentsOnly: true,
      levels: levels.length ? [...new Set(levels)] : null,
      institutions: ["IFMT"],
      campuses,
    },
    cost: null,
    benefits: stipend ? [`${internship ? "Bolsa-estágio" : "Bolsa"} de ${stipend}`] : [],
    tags: ["Edital IFMT", ...(area ? [area] : [])],
    scale: "local",
    note: period
      ? "Lido automaticamente da página do edital: confira datas e requisitos no edital."
      : "Prazo e requisitos: veja no edital.",
    summary: parseSummary(text) ?? describe(text),
    source: "ifmt",
    sourceId: String(post.id),
    verifiedAt,
    status: "open",
  });
}

export async function collectIfmt(options: {
  verifiedAt: string;
  fetchJson?: FetchJson;
}): Promise<{ opportunities: Opportunity[]; skipped: number }> {
  const fetchJson = options.fetchJson ?? politeFetchJson;
  const daysAgo = (days: number) => new Date(Date.parse(options.verifiedAt) - days * 86_400_000).toISOString().slice(0, 10);
  const cutoff = daysAgo(RECENT_DAYS);
  const undatedCutoff = daysAgo(UNDATED_DAYS);

  const opportunities: Opportunity[] = [];
  let skipped = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    // A shape change throws here: better to fail loudly than to publish nothing silently.
    const posts = parseIfmtPage(await fetchJson(`${API_URL}?per_page=${PER_PAGE}&page=${page}&_fields=id,date,link,title,content,class_list`));
    for (const post of posts) {
      const publishedOn = post.date.slice(0, 10);
      const o = publishedOn >= cutoff ? mapIfmtEdital(post, options.verifiedAt) : null;
      if (o && !o.registrationDeadline && publishedOn < undatedCutoff) {
        skipped++;
        continue;
      }
      if (o) opportunities.push(o);
      else skipped++;
    }
    // Newest first: stop at a short page or once the page reaches posts older than the cutoff.
    if (posts.length < PER_PAGE || posts.at(-1)!.date.slice(0, 10) < cutoff) break;
  }
  return { opportunities, skipped };
}
