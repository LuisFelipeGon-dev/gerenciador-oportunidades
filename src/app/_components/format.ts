import type { Opportunity, OpportunityType } from "@/lib/opportunity";
import { daysUntil, keyDate } from "@/lib/personalize";

// Date-only values are stored as UTC midnight; formatting in UTC keeps the day intact.
const short = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const long = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" });
const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });
const orList = new Intl.ListFormat("pt-BR", { type: "disjunction" });

const utc = (isoDate: string) => new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);

export const shortDate = (isoDate: string) => short.format(utc(isoDate));
// A real instant (verifiedAt): shown in the visitor's own time zone, not as its UTC date.
const shortLocal = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
export const instantDate = (isoDateTime: string) => shortLocal.format(new Date(isoDateTime));
export const longDate = (isoDate: string) => long.format(utc(isoDate));
export const weekdayOf = (isoDate: string) => weekday.format(utc(isoDate));
export const monthNames = (months: number[]) =>
  orList.format([...months].sort((a, b) => a - b).map((m) => monthName.format(new Date(Date.UTC(2000, m - 1, 1)))));

export const TYPE_LABEL: Record<OpportunityType, string> = {
  hackathon: "Hackathon",
  event: "Evento",
  ambassador: "Programa",
  scholarship: "Bolsa",
  internship: "Estágio",
};

export const TYPE_PLURAL: Record<OpportunityType, string> = {
  hackathon: "Hackathons",
  event: "Eventos",
  ambassador: "Programas",
  scholarship: "Bolsas",
  internship: "Estágios",
};

/** Tailwind classes per type: text color and tinted background (category is the only decorative color). */
export const TYPE_TONE: Record<OpportunityType, { text: string; bg: string; bar: string }> = {
  hackathon: { text: "text-hack", bg: "bg-hack-bg", bar: "bg-hack" },
  event: { text: "text-event", bg: "bg-event-bg", bar: "bg-event" },
  ambassador: { text: "text-prog", bg: "bg-prog-bg", bar: "bg-prog" },
  scholarship: { text: "text-action", bg: "bg-ground", bar: "bg-action" },
  internship: { text: "text-action", bg: "bg-ground", bar: "bg-action" },
};

export const SOURCE_LABEL: Record<string, string> = {
  devpost: "Devpost",
  mlh: "MLH",
  gdg: "GDG",
  curated: "página oficial, conferida à mão",
};

const NOISE_TAGS = new Set(["GDG", "MLH", "DevFest"]);
export const topicTags = (o: Opportunity) => o.tags.filter((t) => !NOISE_TAGS.has(t));

export function initials(o: Opportunity): string {
  const words = (o.organizer ?? o.title).replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(Boolean);
  const skip = new Set(["de", "da", "do", "dos", "das", "e", "the", "of"]);
  const main = words.filter((w) => !skip.has(w.toLowerCase()));
  const pick = main.length >= 2 ? [main[0], main[1]] : main.length === 1 ? [main[0]] : words.slice(0, 1);
  const letters = pick.length === 1 ? pick[0].slice(0, 2) : pick.map((w) => w[0]).join("");
  return letters.toUpperCase();
}

export function placeLine(o: Opportunity): string {
  if (o.modality === "online") return "De onde você estiver";
  const { city, state, country, raw } = o.location;
  if (city) return [city, country === "BR" ? state : country].filter(Boolean).join(", ");
  return raw?.replace(/[\s,;·-]+$/, "") || "Presencial";
}

export const MODALITY_LABEL: Record<Opportunity["modality"], string> = {
  online: "Online",
  in_person: "Presencial",
  hybrid: "Híbrido",
};

/** The right-hand stub: label, big date and a relative hint. */
export function dateStub(o: Opportunity, today: string | null) {
  if (o.type === "ambassador" && !o.registrationDeadline) {
    if (o.status === "open") return { label: "Inscrições", date: "abertas", hint: null, urgent: false, open: true };
    if (o.typicalOpenMonths.length > 0) {
      return { label: "Costuma abrir", date: monthNames(o.typicalOpenMonths), hint: null, urgent: false, open: false };
    }
    return { label: "Inscrições", date: "fechadas", hint: null, urgent: false, open: false };
  }
  const date = keyDate(o);
  if (!date) return { label: "Data", date: "a confirmar", hint: null, urgent: false, open: false };
  const isDeadline = !!o.registrationDeadline;
  const days = today ? daysUntil(date, today) : null;
  let hint: string | null = null;
  if (days !== null) {
    if (isDeadline) hint = days === 0 ? "fecha hoje" : days === 1 ? "fecha amanhã" : `fecha em ${days} dias`;
    else hint = days === 0 ? "é hoje" : days === 1 ? "é amanhã" : days < 7 ? `daqui a ${days} dias` : weekdayOf(date);
  }
  return {
    label: isDeadline ? "Inscrições até" : "Acontece em",
    date: shortDate(date),
    hint,
    urgent: isDeadline && days !== null && days <= 7,
    open: false,
  };
}
