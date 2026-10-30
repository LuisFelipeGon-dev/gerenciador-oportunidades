import { extractText as pdfExtractText, getDocumentProxy } from "unpdf";
import { z } from "zod";
import { parseInscriptionPeriod, parseStipend, parseSummary } from "../lib/edital-text";
import { campusCity, campusFromText } from "../lib/institutions";
import { opportunitySchema, type Opportunity, type OpportunityType } from "../lib/opportunity";
import { politeFetchBytes, politeFetchResponse, politeFetchText, type FetchBytes, type FetchText } from "./http";
import { extractText } from "./page-monitor";

// UNEMAT calls for proposals (editais) for students. The list comes from the search of the
// public site (unemat.br/editais, robots.txt allows everything, checked 2026-10-29), one search
// per student category; the PDF of each call is read by rules (src/lib/edital-text.ts).

const LIST_URL = "https://unemat.br/editais";
const SEARCH_URL = "https://unemat.br/editais/busca";
const RECENT_DAYS = 60;
const HEADING_CHARS = 800;
/** Main seat, for calls that name no campus. */
const DEFAULT_CAMPUS_CITY = "Cáceres";

/** Student categories of the search ("tipoEdital" ids) and the type each one becomes. */
export const UNEMAT_TYPES: Record<string, OpportunityType> = {
  "22": "internship", // Contratação de Estagiários
  "19": "scholarship", // Bolsa de Iniciação Científica
  "20": "scholarship", // Auxílio Alimentação e Moradia
  "21": "scholarship", // Auxílio Inclusão Digital
  "23": "scholarship", // Bolsa Extensão
  "32": "scholarship", // Bolsa Formação
  "38": "scholarship", // Bolsa Pibid
  "39": "scholarship", // Bolsa Residência Pedagógica
  "40": "scholarship", // Bolsa Focco
  "43": "scholarship", // Monitoria Voluntária
  "45": "scholarship", // Bolsas e voluntários
  "75": "scholarship", // Bolsa Iniciação em Desenvolvimento Tecnológico e Inovação
  "76": "scholarship", // Bolsa Extensão Tecnológica
  "101": "scholarship", // Auxílio Evento
  "102": "scholarship", // Auxílio Transporte
  "103": "scholarship", // Auxílio Indígena
  "104": "scholarship", // Bolsa Integradora
  "105": "scholarship", // Bolsa Intercâmbio
  "115": "scholarship", // PET Tutorial
};

export type UnematItem = { url: string; title: string; category: string; publishedOn: string };

const MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, FEV: 2, MAR: 3, APR: 4, ABR: 4, MAY: 5, MAI: 5, JUN: 6, JUL: 7,
  AUG: 8, AGO: 8, SEP: 9, SET: 9, OCT: 10, OUT: 10, NOV: 11, DEC: 12, DEZ: 12,
};
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/**
 * Items of a search result. The list shows day and month only: the year comes from the link
 * ("/editais/9-10-2026-…") when it has one, otherwise it is the latest one not in the future.
 */
export function parseSearchResults(html: string, today: string): UnematItem[] {
  const items: UnematItem[] = [];
  const item = /edital-data-item">\s*(\d{1,2})\s*<\/div>\s*<div class="edital-data-item">\s*(\w+)\s*<[\s\S]*?class="edital-titulo" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?Categoria:([^<]*)</g;
  for (const [, day, monthName, url, title, category] of html.matchAll(item)) {
    const d = Number(day);
    const m = MONTHS[monthName.toUpperCase()];
    if (!m) continue;
    const inLink = /\/editais\/(\d{1,2})-(\d{1,2})-(\d{4})-/.exec(url);
    let year = Number(today.slice(0, 4));
    if (inLink && Number(inLink[1]) === d && Number(inLink[2]) === m) year = Number(inLink[3]);
    else if (iso(year, m, d) > today) year--;
    items.push({ url, title: extractText(title), category: extractText(category), publishedOn: iso(year, m, d) });
  }
  return items;
}

const SUPPLEMENT = /complementar|resultado|retifica|homologa|errata|convoca/i;

const documents = (detailHtml: string) =>
  [...detailHtml.matchAll(/class="[^"]*edital-documento-titulo[^"]*" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, href, title]) => ({
    href,
    title: extractText(title),
  }));

/** Whether the page of a call already lists its final result: the selection is over. */
export function hasFinalResult(detailHtml: string): boolean {
  return documents(detailHtml).some((d) => /resultado final|resultado definitivo/i.test(d.title));
}

/** The PDF of the call itself: the oldest document that is not a supplement (results, fixes). */
export function mainDocumentUrl(detailHtml: string): string | null {
  const docs = documents(detailHtml);
  if (!docs.length) return null;
  // Newest first on the page.
  return (docs.findLast((d) => !SUPPLEMENT.test(d.title)) ?? docs[docs.length - 1]).href;
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const NOT_FOR_STUDENTS = /tutor|docente|professor|servidor|tecnico[s]?[- ]administrativ|resultado|retifica|homologa|complementar|eleicao|errata/;

/** The category already says it is for students; the title still rules out staff and supplements. */
export function isUnematStudentCall(title: string): boolean {
  return !NOT_FOR_STUDENTS.test(fold(title));
}

/**
 * Whether the title only names years before the one it was published in ("EDITAL 005_2021"):
 * old calls the site lists again with a recent date when a document is added to them.
 */
export function isFromPastYears(title: string, publishedOn: string): boolean {
  const years = [...title.matchAll(/(?<!\d)(20\d{2})(?!\d)/g)].map((m) => Number(m[1]));
  return years.length > 0 && Math.max(...years) < Number(publishedOn.slice(0, 4));
}

const SECTOR =/\b(PRAE|PROEG|PRPPG|PROEC|PRAD|PRPTI|PGF)\b/;

export function mapUnematEdital(item: UnematItem, type: OpportunityType, pdfText: string | null, verifiedAt: string): Opportunity | null {
  const today = verifiedAt.slice(0, 10);
  const period = pdfText ? parseInscriptionPeriod(pdfText) : null;
  if (period && period.end < today) return null;

  const heading = pdfText?.slice(0, HEADING_CHARS) ?? "";
  const campus = campusFromText("UNEMAT", item.title) ?? (heading ? campusFromText("UNEMAT", heading) : null);
  const sector = SECTOR.exec(item.title)?.[1] ?? SECTOR.exec(heading)?.[1];
  const stipend = pdfText ? parseStipend(pdfText) : null;

  return opportunitySchema.parse({
    type,
    title: item.title,
    organizer: sector ? `UNEMAT · ${sector}` : "UNEMAT",
    officialUrl: item.url,
    modality: "in_person",
    location: {
      raw: campus ? `UNEMAT, câmpus ${campus}` : "UNEMAT",
      city: (campus && campusCity("UNEMAT", campus)) ?? DEFAULT_CAMPUS_CITY,
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
      levels: ["undergraduate"],
      institutions: ["UNEMAT"],
      campuses: campus ? [campus] : null,
    },
    cost: null,
    benefits: stipend ? [`${type === "internship" ? "Bolsa-estágio" : "Bolsa"} de ${stipend}`] : [],
    tags: [...new Set(["Edital UNEMAT", item.category].filter(Boolean))],
    scale: "local",
    note: period
      ? "Lido automaticamente do edital: confira datas e requisitos no PDF."
      : "Prazo e requisitos: veja no edital. Lido automaticamente: confira no PDF.",
    summary: pdfText ? parseSummary(pdfText) : null,
    source: "unemat",
    sourceId: new URL(item.url).pathname.replace(/^\/editais\//, ""),
    verifiedAt,
    status: "open",
  });
}

const searchSchema = z.object({ editais: z.string().nullable() });

/**
 * The site's own search: a session (cookie and CSRF token) from the list page, then one POST per
 * category, like the "Buscar" button. Returns the HTML of the first page of results.
 */
function siteSearch(): (type: string) => Promise<string> {
  let session: Promise<{ token: string; cookies: string }> | null = null;
  const open = async () => {
    const res = await politeFetchResponse(LIST_URL, { headers: { Accept: "text/html" } });
    const token = /name="csrf-token" content="([^"]+)"/.exec(await res.text())?.[1];
    if (!token) throw new Error("unemat: no CSRF token on the list page");
    return { token, cookies: res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ") };
  };
  return async (type) => {
    session ??= open();
    const { token, cookies } = await session;
    const form = new FormData();
    const fields = { texto_busca_editais: "", numero_pagina_editais: "1", origemEdital: "", tipoEdital: type, statusEdital: "", anoEdital: "" };
    for (const [k, v] of Object.entries(fields)) form.set(k, v);
    const res = await politeFetchResponse(SEARCH_URL, {
      method: "POST",
      body: form,
      headers: { Accept: "application/json", "X-CSRF-TOKEN": token, Cookie: cookies },
    });
    return searchSchema.parse(await res.json()).editais ?? "";
  };
}

async function pdfToTextWithUnpdf(bytes: Uint8Array): Promise<string> {
  const { text } = await pdfExtractText(await getDocumentProxy(bytes), { mergePages: true });
  return text;
}

export async function collectUnemat(options: {
  verifiedAt: string;
  types?: Record<string, OpportunityType>;
  search?: (type: string) => Promise<string>;
  fetchText?: FetchText;
  fetchBytes?: FetchBytes;
  pdfToText?: (bytes: Uint8Array) => Promise<string>;
}): Promise<{ opportunities: Opportunity[]; skipped: number }> {
  const search = options.search ?? siteSearch();
  const fetchText = options.fetchText ?? politeFetchText;
  const fetchBytes = options.fetchBytes ?? politeFetchBytes;
  const pdfToText = options.pdfToText ?? pdfToTextWithUnpdf;
  const today = options.verifiedAt.slice(0, 10);
  const cutoff = new Date(Date.parse(options.verifiedAt) - RECENT_DAYS * 86_400_000).toISOString().slice(0, 10);

  const opportunities: Opportunity[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const [id, type] of Object.entries(options.types ?? UNEMAT_TYPES)) {
    for (const item of parseSearchResults(await search(id), today)) {
      if (seen.has(item.url) || item.publishedOn < cutoff || !isUnematStudentCall(item.title) || isFromPastYears(item.title, item.publishedOn)) {
        skipped++;
        continue;
      }
      seen.add(item.url);
      let text: string | null = null;
      try {
        const detail = await fetchText(item.url);
        if (hasFinalResult(detail)) {
          skipped++;
          continue;
        }
        const pdf = mainDocumentUrl(detail);
        if (pdf) text = await pdfToText(await fetchBytes(pdf));
      } catch (err) {
        console.warn(`unemat: could not read the PDF of ${item.url}: ${err instanceof Error ? err.message : err}`);
      }
      const o = mapUnematEdital(item, type, text, options.verifiedAt);
      if (o) opportunities.push(o);
      else skipped++;
    }
  }
  return { opportunities, skipped };
}
