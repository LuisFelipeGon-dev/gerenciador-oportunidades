// Reading the text of a university call for proposals (edital), by rules: the inscription
// period, what it is for, the stipend and the campus. Nothing is guessed: when a pattern is not
// found the result is null and the site says "veja no edital".

const MONTHS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};
const MONTH = "(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)";
/** How far after "inscri…" a date may be and still be the inscription period. */
const WINDOW = 200;
const MAX_SUMMARY = 240;

const flat = (text: string) => text.replace(/\s+/g, " ");
const stripAccents = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "");
const month = (name: string) => MONTHS[stripAccents(name.toLowerCase())];
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function periodIn(window: string): { start: string | null; end: string } | null {
  const written = new RegExp(
    `(\\d{1,2})º? de ${MONTH}(?: de (\\d{4}))? (?:a|at[eé]) (?:o dia )?(\\d{1,2})º? de ${MONTH} de (\\d{4})`,
    "i",
  ).exec(window);
  if (written) {
    const [, d1, m1, y1, d2, m2, y2] = written;
    const endYear = Number(y2);
    const startMonth = month(m1);
    // "de 15 de dezembro a 10 de janeiro de 2027": the start is in the year before.
    const startYear = y1 ? Number(y1) : startMonth > month(m2) ? endYear - 1 : endYear;
    return { start: iso(startYear, startMonth, Number(d1)), end: iso(endYear, month(m2), Number(d2)) };
  }

  const numeric = /(\d{1,2})\/(\d{1,2})\/(\d{4}) (?:a|at[eé]) (\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(window);
  if (numeric) {
    const [, d1, m1, y1, d2, m2, y2] = numeric.map(Number);
    return { start: iso(y1, m1, d1), end: iso(y2, m2, d2) };
  }

  const until = new RegExp(`at[eé] (?:o dia )?(\\d{1,2})º? de ${MONTH} de (\\d{4})`, "i").exec(window);
  if (until) return { start: null, end: iso(Number(until[3]), month(until[2]), Number(until[1])) };

  const untilNumeric = /at[eé] (?:o dia )?(\d{1,2})\/(\d{1,2})\/(\d{4})/i.exec(window);
  if (untilNumeric) return { start: null, end: iso(Number(untilNumeric[3]), Number(untilNumeric[2]), Number(untilNumeric[1])) };

  return null;
}

/** The inscription period, looked for only right after a mention of "inscrição". */
export function parseInscriptionPeriod(text: string): { start: string | null; end: string } | null {
  const t = flat(text);
  for (const m of t.matchAll(/inscri[cç](?:[aã]o|[oõ]es)/gi)) {
    const found = periodIn(t.slice(m.index, m.index + m[0].length + WINDOW));
    if (found) return found;
  }
  return null;
}

/** What the edital is for: the clause after "torna público o presente Edital para". */
export function parseSummary(text: string): string | null {
  const t = flat(text);
  const opening = /torna(?:m)? p[uú]blic[oa] (?:o presente edital para|a abertura d[eoa]s?|o edital d[eoa]s?)\s*/i.exec(t);
  if (!opening) return null;
  let clause = t.slice(opening.index + opening[0].length);
  // Up to the end of the sentence, or where the boilerplate begins.
  clause = clause.split(/\.\s|, de acordo com|, conforme|:\s/i)[0].replace(/^(?:o|a|os|as)\s+/i, "").trim();
  if (!clause) return null;
  clause = clause[0].toUpperCase() + clause.slice(1);
  if (clause.length <= MAX_SUMMARY) return clause;
  const cut = clause.slice(0, MAX_SUMMARY - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:\s]+$/, "")}…`;
}

/** The first stipend value near "bolsa" or "auxílio", as "R$ 700,00". */
export function parseStipend(text: string): string | null {
  const m = /(?:bolsa|aux[ií]lio).{0,80}?R\$\s?(\d{1,3}(?:\.\d{3})*,\d{2})/i.exec(flat(text));
  return m ? `R$ ${m[1]}` : null;
}

const CAMPUSES = [
  { key: "cuiaba", name: "Cuiabá" },
  { key: "varzea grande", name: "Várzea Grande" },
  { key: "sinop", name: "Sinop" },
  { key: "araguaia", name: "Araguaia" },
] as const;

export type UfmtCampus = (typeof CAMPUSES)[number]["name"];

/** The UFMT campus a title is restricted to, when it names one ("CAMPUS CUIABÁ"). */
export function campusFromTitle(title: string): UfmtCampus | null {
  const t = stripAccents(title.toLowerCase());
  if (!/campus/.test(t)) return null;
  return CAMPUSES.find((c) => t.includes(c.key))?.name ?? null;
}
