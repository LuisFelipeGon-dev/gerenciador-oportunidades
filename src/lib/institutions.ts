// Institutions whose calls for proposals (editais) the site collects, with their campuses: the
// city of each one (for distances) and the other names a call may use for it.

export type Campus = { name: string; city: string; aliases?: string[] };

const c = (name: string, city = name, aliases?: string[]): Campus => ({ name, city, aliases });

export const INSTITUTIONS: Record<string, Campus[]> = {
  UFMT: [c("Cuiabá"), c("Várzea Grande"), c("Sinop"), c("Araguaia", "Barra do Garças")],
  UNEMAT: [
    c("Alta Floresta"),
    c("Alto Araguaia"),
    c("Barra do Bugres"),
    c("Cáceres"),
    c("Colíder"),
    c("Diamantino"),
    c("Juara"),
    c("Médio Araguaia", "Luciara"),
    c("Nova Mutum"),
    c("Nova Xavantina"),
    c("Pontes e Lacerda"),
    c("Sinop"),
    c("Tangará da Serra"),
  ],
  IFMT: [
    c("Água Boa"),
    c("Alta Floresta"),
    c("Barra do Garças"),
    c("Cáceres"),
    c("Campo Novo do Parecis"),
    c("Campo Verde"),
    c("Canarana"),
    c("Colniza"),
    c("Confresa"),
    c("Cuiabá - Bela Vista", "Cuiabá", ["bela vista"]),
    c("Cuiabá - Octayde", "Cuiabá", ["octayde"]),
    c("Diamantino"),
    c("Guarantã do Norte"),
    c("Jaciara", "Jaciara", ["centro de referencia de jaciara"]),
    c("Juína"),
    c("Lucas do Rio Verde"),
    c("Paranaíta"),
    c("Pontes e Lacerda"),
    c("Primavera do Leste"),
    c("Rondonópolis"),
    c("São Vicente", "Santo Antônio do Leverger"),
    c("Sinop"),
    c("Sorriso"),
    c("Tangará da Serra"),
    c("Várzea Grande"),
  ],
};

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const campusesOf = (institution: string) => INSTITUTIONS[institution.trim().toUpperCase()] ?? [];

/** Names of the campuses of an institution, for the profile form ("" or unknown: none). */
export function campusNames(institution: string): string[] {
  return campusesOf(institution).map((x) => x.name);
}

export function campusCity(institution: string, campus: string): string | null {
  return campusesOf(institution).find((x) => fold(x.name) === fold(campus))?.city ?? null;
}

/**
 * The campus a text is restricted to, when it says "campus"/"câmpus" and names one. The first
 * name in the text wins; at the same place the longer one ("Alto Araguaia" over "Araguaia").
 */
export function campusFromText(institution: string, text: string): string | null {
  const t = fold(text);
  if (!/c[aâ]mpus/.test(t)) return null;
  let best: { at: number; length: number; name: string } | null = null;
  for (const campus of campusesOf(institution)) {
    for (const key of [campus.name, ...(campus.aliases ?? [])].map(fold)) {
      const m = new RegExp(`(?<![\\p{L}])${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "u").exec(t);
      if (m && (!best || m.index < best.at || (m.index === best.at && key.length > best.length))) {
        best = { at: m.index, length: key.length, name: campus.name };
      }
    }
  }
  return best?.name ?? null;
}

/** "da UFMT", "do IFMT": institutes (IF…) are masculine. */
export function withArticle(institutions: string): string {
  return `${/^IF/i.test(institutions.trim()) ? "do" : "da"} ${institutions}`;
}
