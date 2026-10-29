import { extractText, getDocumentProxy } from "unpdf";
import { z } from "zod";
import { campusFromTitle, parseInscriptionPeriod, parseStipend, parseSummary, type UfmtCampus } from "../lib/edital-text";
import { opportunitySchema, type Opportunity } from "../lib/opportunity";
import { politeFetchBytes, politeFetchJson, type FetchBytes, type FetchJson } from "./http";

// UFMT calls for proposals (editais) for students, from the API behind the university's public
// portal (use authorized by the project owner, 2026-10-29). The PDF of each call is read by rules
// (src/lib/edital-text.ts) for the inscription period, a summary and the stipend.

const API_URL = "https://api-portal.ufmt.br/v1/publications";
/** Pró-reitorias with student calls: graduação, assistência estudantil, pesquisa, extensão. */
export const UFMT_BRANCHES = [
  { id: 17, acronym: "PROEG" },
  { id: 11, acronym: "PRAE" },
  { id: 13, acronym: "PROPESQ" },
  { id: 10, acronym: "PROCEV" },
] as const;
const RECENT_DAYS = 60;
/** Start of the PDF text that holds its heading (title of the call, campus). */
const HEADING_CHARS = 800;

const publicationSchema = z.object({
  id: z.number(),
  title: z.string(),
  publication_date: z.string(),
  category: z.object({ name: z.string() }).nullable().optional(),
  files: z.array(z.object({ filename: z.string() })),
});
const pageSchema = z.object({ data: z.array(publicationSchema) });

export type UfmtPublication = z.infer<typeof publicationSchema>;

export function parsePublicationsPage(json: unknown): UfmtPublication[] {
  return pageSchema.parse(json).data;
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// Calls for staff, results and corrections are not opportunities for students.
const NOT_FOR_STUDENTS = /docente|professor|servidor|tecnico[s]?[- ]administrativ|tutor|facilitador|regulariza|resultado|homologa|retifica/;
// Not "extensão" alone: extension programs are mostly calls for staff to propose projects.
const FOR_STUDENTS = /bolsist|bolsa|estudante|aluno|discente|monitori|pibic|pibiti|iniciacao|auxilio|permanencia|mobilidade|intercambio|idioma|voluntari|esporte/;
const IS_A_CALL = /edital|programa|chamada|processo seletivo|selecao/;

/** Whether a title is a call students can apply to. */
export function isStudentCall(title: string): boolean {
  const t = fold(title);
  return IS_A_CALL.test(t) && FOR_STUDENTS.test(t) && !NOT_FOR_STUDENTS.test(t);
}

/** "Edital 016/2026 - PROEG/CFD/GPE - Seleção…" -> "Edital 016/2026 - Seleção…" */
export function cleanTitle(title: string): string {
  return title
    .replace(/\s*[-–/]*\s*(?:PROEG|PRAE|PROPESQ|PROCEV)(?:\s*[-/]\s*(?:CFD|GPE|UFMT|\d{4}))*\s*[-–/]*\s*/g, " - ")
    .replace(/(?:\s-\s)+/g, " - ")
    .replace(/^\s*-\s*|\s*-\s*$/g, "")
    // The code sat between "EDITAL" and "Nº": no dash there.
    .replace(/^(edital) - (n[º°o]\.?)/i, "$1 $2")
    .trim();
}

/** City of each campus, for distances ("Araguaia" has its main unit in Barra do Garças). */
const CAMPUS_CITY: Record<UfmtCampus, string> = {
  Cuiabá: "Cuiabá",
  "Várzea Grande": "Várzea Grande",
  Sinop: "Sinop",
  Araguaia: "Barra do Garças",
};

export function mapUfmtPublication(
  p: UfmtPublication,
  branch: { id: number; acronym: string },
  pdfText: string | null,
  verifiedAt: string,
): Opportunity | null {
  const file = p.files[0]?.filename;
  if (!file) return null;
  const today = verifiedAt.slice(0, 10);
  const period = pdfText ? parseInscriptionPeriod(pdfText) : null;
  if (period && period.end < today) return null;

  // The campus is in the title or, more often, in the heading of the PDF ("… - CAMPUS CUIABÁ").
  const campus = campusFromTitle(p.title) ?? (pdfText ? campusFromTitle(pdfText.slice(0, HEADING_CHARS)) : null);
  const stipend = pdfText ? parseStipend(pdfText) : null;

  return opportunitySchema.parse({
    type: "scholarship",
    title: cleanTitle(p.title),
    organizer: `UFMT · ${branch.acronym}`,
    officialUrl: new URL(file).toString(),
    modality: "in_person",
    location: {
      raw: `UFMT, câmpus ${campus ?? "Cuiabá"}`,
      city: CAMPUS_CITY[campus ?? "Cuiabá"],
      state: "MT",
      country: "BR",
      lat: null,
      lng: null,
    },
    // Only the deadline: the opening of the inscription is not an event day for the Agenda.
    startsOn: null,
    endsOn: null,
    registrationDeadline: period?.end ?? null,
    eligibility: {
      countries: null,
      minAge: null,
      studentsOnly: true,
      levels: ["undergraduate"],
      institutions: ["UFMT"],
      campuses: campus ? [campus] : null,
    },
    cost: null,
    benefits: stipend ? [`Bolsa de ${stipend}`] : [],
    tags: [...new Set(["Edital UFMT", p.category?.name].filter((t): t is string => !!t))],
    scale: "local",
    note: period
      ? "Lido automaticamente do edital: confira datas e requisitos no PDF."
      : "Prazo e requisitos: veja no edital. Lido automaticamente: confira no PDF.",
    summary: pdfText ? parseSummary(pdfText) : null,
    source: "ufmt",
    sourceId: String(p.id),
    verifiedAt,
    status: "open",
  });
}

async function pdfToTextWithUnpdf(bytes: Uint8Array): Promise<string> {
  const { text } = await extractText(await getDocumentProxy(bytes), { mergePages: true });
  return text;
}

export async function collectUfmt(options: {
  verifiedAt: string;
  fetchJson?: FetchJson;
  fetchBytes?: FetchBytes;
  pdfToText?: (bytes: Uint8Array) => Promise<string>;
}): Promise<{ opportunities: Opportunity[]; skipped: number }> {
  const fetchJson = options.fetchJson ?? politeFetchJson;
  const fetchBytes = options.fetchBytes ?? politeFetchBytes;
  const pdfToText = options.pdfToText ?? pdfToTextWithUnpdf;
  const cutoff = new Date(Date.parse(options.verifiedAt) - RECENT_DAYS * 86_400_000).toISOString().slice(0, 10);

  const opportunities: Opportunity[] = [];
  let skipped = 0;
  for (const branch of UFMT_BRANCHES) {
    // A shape change throws here: better to fail loudly than to publish nothing silently.
    const publications = parsePublicationsPage(await fetchJson(`${API_URL}?branch=${branch.id}&page=1`));
    for (const p of publications) {
      if (p.publication_date.slice(0, 10) < cutoff || !isStudentCall(p.title)) {
        skipped++;
        continue;
      }
      let text: string | null = null;
      const file = p.files[0]?.filename;
      if (file) {
        try {
          text = await pdfToText(await fetchBytes(new URL(file).toString()));
        } catch (err) {
          console.warn(`ufmt: could not read the PDF of ${p.id}: ${err instanceof Error ? err.message : err}`);
        }
      }
      const o = mapUfmtPublication(p, branch, text, options.verifiedAt);
      if (o) opportunities.push(o);
      else skipped++;
    }
  }
  return { opportunities, skipped };
}
