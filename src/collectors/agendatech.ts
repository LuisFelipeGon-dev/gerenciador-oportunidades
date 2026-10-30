import { z } from "zod";
import { opportunitySchema, type Opportunity } from "../lib/opportunity";
import { politeFetchJson, type FetchJson } from "./http";

// Agenda Tech Brasil: tech events across Brazil, kept by the community in an open GitHub
// repository (github.com/agenda-tech-brasil/agenda-tech-brasil). The site credits it as the
// source of each event. The repository has no license file; only facts (name, dates, city and
// link) are used, with credit (approved by the project owner, 2026-10-30).

const DATABASE_URL = "https://raw.githubusercontent.com/agenda-tech-brasil/agenda-tech-brasil/main/src/db/database.json";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
/** Links that are not an event's page (a badge image the list once used by mistake). */
const NOT_A_PAGE = new Set(["img.shields.io"]);

const eventSchema = z.object({
  nome: z.string(),
  data: z.array(z.string()),
  url: z.string(),
  cidade: z.string().optional().default(""),
  uf: z.string().optional().default(""),
  tipo: z.string(),
});
const databaseSchema = z.object({
  eventos: z.array(
    z.object({
      ano: z.number().int(),
      meses: z.array(z.object({ mes: z.string(), eventos: z.array(z.unknown()) })),
    }),
  ),
});

export type AgendaEvent = {
  name: string;
  url: string;
  city: string | null;
  state: string | null;
  kind: string;
  startsOn: string;
  endsOn: string;
};

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Every event with a date and a page. One odd entry is skipped; a new file format throws. */
export function parseDatabase(json: unknown): AgendaEvent[] {
  const events: AgendaEvent[] = [];
  for (const year of databaseSchema.parse(json).eventos) {
    for (const month of year.meses) {
      const m = MONTHS.indexOf(month.mes.toLowerCase()) + 1;
      if (!m) continue;
      for (const raw of month.eventos) {
        const parsed = eventSchema.safeParse(raw);
        if (!parsed.success) continue;
        const e = parsed.data;
        const days = e.data.map(Number).filter((d) => d >= 1 && d <= 31);
        let url: URL;
        try {
          url = new URL(e.url);
        } catch {
          continue;
        }
        if (!days.length || !/^https?:$/.test(url.protocol) || NOT_A_PAGE.has(url.hostname)) continue;
        const first = days[0];
        const last = days[days.length - 1];
        // "30, 31, 01": the last day is in the next month.
        const end = last < first ? (m === 12 ? iso(year.ano + 1, 1, last) : iso(year.ano, m + 1, last)) : iso(year.ano, m, last);
        events.push({
          name: e.nome.trim(),
          url: e.url,
          city: e.cidade.trim() || null,
          state: e.uf.trim().toUpperCase() || null,
          kind: e.tipo.trim().toLowerCase(),
          startsOn: iso(year.ano, m, first),
          endsOn: end,
        });
      }
    }
  }
  return events;
}

const slug = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function modalityOf(kind: string): Opportunity["modality"] {
  if (kind === "online") return "online";
  if (kind.startsWith("h")) return "hybrid"; // "híbrido"
  return "in_person";
}

export function mapAgendaEvent(e: AgendaEvent, verifiedAt: string): Opportunity {
  const modality = modalityOf(e.kind);
  const online = modality === "online";
  return opportunitySchema.parse({
    type: "event",
    title: e.name,
    organizer: null,
    officialUrl: e.url,
    modality,
    location: {
      raw: online ? null : [e.city, e.state].filter(Boolean).join("/") || null,
      city: online ? null : e.city,
      state: online ? null : e.state,
      country: "BR",
      lat: null,
      lng: null,
    },
    startsOn: e.startsOn,
    endsOn: e.endsOn,
    registrationDeadline: null,
    eligibility: { countries: null, minAge: null, studentsOnly: null, levels: null },
    cost: null,
    benefits: [],
    tags: [],
    scale: "national",
    source: "agendatech",
    sourceId: `${e.startsOn}-${slug(e.name)}`,
    verifiedAt,
    status: "open",
  });
}

export async function collectAgendaTech(options: {
  verifiedAt: string;
  fetchJson?: FetchJson;
}): Promise<{ opportunities: Opportunity[]; skipped: number }> {
  const fetchJson = options.fetchJson ?? politeFetchJson;
  const today = options.verifiedAt.slice(0, 10);
  const events = parseDatabase(await fetchJson(DATABASE_URL));
  const upcoming = events.filter((e) => e.endsOn >= today);
  return {
    opportunities: upcoming.map((e) => mapAgendaEvent(e, options.verifiedAt)),
    skipped: events.length - upcoming.length,
  };
}
