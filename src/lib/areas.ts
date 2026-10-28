import type { OpportunityType } from "./opportunity";

// Areas group courses so the home page can adapt: which kinds of opportunity matter by default,
// how to talk about them, and what this area still lacks in our sources.

export const AREA_IDS = [
  "tech", "engineering", "design", "business", "communication", "health",
  "law", "education", "sciences", "humanities", "agrarian", "other",
] as const;
export type AreaId = (typeof AREA_IDS)[number];

export type Area = {
  id: AreaId;
  label: string;
  /** Kinds shown when the person has not picked interests. */
  defaultTypes: OpportunityType[];
  /** Whether today's (tech) sources are the core of this area or only "open to any course". */
  techIsCore: boolean;
  /** What we would like to cover for this area and do not collect yet. */
  missing: string;
  /** Lowercase, accent-free fragments that identify a course in this area. */
  keywords: string[];
};

export const AREAS: Area[] = [
  {
    id: "tech",
    label: "Tecnologia e computação",
    defaultTypes: ["hackathon", "event", "ambassador", "competition", "internship"],
    techIsCore: true,
    missing: "estágios em tecnologia",
    keywords: ["computa", "sistemas de informa", "software", "analise e desenvolvimento", "ads", "dados", "informatica", "ciberseg", "redes de computa", "jogos digitais", "inteligencia artificial", "tecnologia da informa"],
  },
  {
    id: "engineering",
    label: "Engenharias",
    defaultTypes: ["hackathon", "event", "ambassador", "competition"],
    techIsCore: true,
    missing: "competições de engenharia e estágios",
    keywords: ["engenharia", "mecatron", "automacao"],
  },
  {
    id: "design",
    label: "Design e arquitetura",
    defaultTypes: ["hackathon", "event"],
    techIsCore: false,
    missing: "concursos de design e arquitetura",
    keywords: ["design", "arquitetura", "urbanismo", "moda", "artes visuais"],
  },
  {
    id: "business",
    label: "Negócios e economia",
    defaultTypes: ["event", "ambassador"],
    techIsCore: false,
    missing: "desafios de negócios, ligas de mercado e trainees",
    keywords: ["administra", "economia", "contab", "gestao", "marketing", "comercio exterior", "logistica", "financ"],
  },
  {
    id: "communication",
    label: "Comunicação",
    defaultTypes: ["event", "ambassador"],
    techIsCore: false,
    missing: "prêmios de jornalismo, coberturas e programas de redação",
    keywords: ["jornalis", "publicidade", "propaganda", "relacoes publicas", "comunica", "cinema", "audiovisual", "radio"],
  },
  {
    id: "health",
    label: "Saúde",
    defaultTypes: ["event"],
    techIsCore: false,
    missing: "congressos, ligas acadêmicas e iniciação científica em saúde",
    keywords: ["medicina", "enfermagem", "farmacia", "nutri", "psicolog", "odonto", "fisioterap", "educacao fisica", "biomedic", "fonoaudio", "veterinaria"],
  },
  {
    id: "law",
    label: "Direito",
    defaultTypes: ["event"],
    techIsCore: false,
    missing: "competições de arbitragem, júris simulados e estágios jurídicos",
    keywords: ["direito"],
  },
  {
    id: "education",
    label: "Educação e letras",
    defaultTypes: ["event"],
    techIsCore: false,
    missing: "programas de iniciação à docência e monitoria",
    keywords: ["pedagog", "letras", "licenciatura", "educacao"],
  },
  {
    id: "sciences",
    label: "Ciências exatas e naturais",
    defaultTypes: ["hackathon", "event", "competition"],
    techIsCore: false,
    missing: "iniciação científica e escolas de verão",
    keywords: ["matematica", "fisica", "quimica", "biolog", "estatistica", "geolog", "astronom"],
  },
  {
    id: "humanities",
    label: "Humanas e sociais",
    defaultTypes: ["event"],
    techIsCore: false,
    missing: "simulações da ONU, iniciação científica e intercâmbio",
    keywords: ["historia", "geografia", "sociolog", "ciencias sociais", "filosof", "relacoes internacionais", "antropolog", "servico social", "ciencia politica"],
  },
  {
    id: "agrarian",
    label: "Agrárias",
    defaultTypes: ["hackathon", "event"],
    techIsCore: false,
    missing: "eventos do agro, hackathons de agrotech e estágios no campo",
    keywords: ["agronom", "zootecnia", "agricola", "florestal", "agroneg", "agrotec"],
  },
  {
    id: "other",
    label: "Outra área",
    defaultTypes: ["hackathon", "event", "ambassador"],
    techIsCore: false,
    missing: "oportunidades específicas do seu curso",
    keywords: [],
  },
];

const BY_ID = new Map(AREAS.map((a) => [a.id, a]));

export function areaById(id: string | null | undefined): Area {
  return BY_ID.get(id as AreaId) ?? BY_ID.get("other")!;
}

function normalize(text: string): string {
  return ` ${text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

/** Guesses the area from what the person typed as course; "other" when nothing matches. */
export function areaForCourse(course: string): AreaId {
  const text = normalize(course);
  // "Engenharia de Computação/Software" belongs to tech, not to the generic engineering bucket.
  const tech = AREAS[0];
  if (tech.keywords.some((k) => text.includes(` ${k}`))) return "tech";
  for (const area of AREAS.slice(1)) {
    if (area.keywords.some((k) => text.includes(` ${k}`))) return area.id;
  }
  return "other";
}
