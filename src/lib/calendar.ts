import type { Opportunity } from "./opportunity";

export type CalendarEvent = {
  uid: string;
  title: string;
  /** First day, YYYY-MM-DD. All-day events only: the sources rarely publish times. */
  start: string;
  /** Last day, inclusive. */
  end: string;
  description: string;
  url: string;
  location: string | null;
};

const MONTHS_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * What to put on the calendar for an opportunity:
 * the registration deadline, else the event days, else (closed programs) the month it usually opens.
 */
export function calendarEventFor(o: Opportunity, siteUrl: string, today: string): CalendarEvent | null {
  const uid = `${o.source}-${o.sourceId}@oportunidades`;
  const where = o.modality === "online" ? "Online" : (o.location.raw ?? o.location.city);
  const base = { uid, url: o.officialUrl, location: where };
  const more = `Página oficial: ${o.officialUrl}\nMais detalhes: ${siteUrl}`;

  if (o.registrationDeadline) {
    return {
      ...base,
      title: `Prazo: ${o.title}`,
      start: o.registrationDeadline,
      end: o.registrationDeadline,
      description: `Último dia para se inscrever em ${o.title}.\n${more}`,
    };
  }
  if (o.startsOn) {
    return {
      ...base,
      title: o.title,
      start: o.startsOn,
      end: o.endsOn ?? o.startsOn,
      description: `${o.organizer ? `${o.organizer}. ` : ""}Confira inscrição e valores antes.\n${more}`,
    };
  }
  if (o.status === "closed" && o.typicalOpenMonths.length > 0) {
    const [year, month] = today.split("-").map(Number);
    const next = [...o.typicalOpenMonths].sort((a, b) => a - b).find((m) => m > month);
    const target = next ?? Math.min(...o.typicalOpenMonths);
    const targetYear = next ? year : year + 1;
    const day = `${targetYear}-${String(target).padStart(2, "0")}-01`;
    return {
      ...base,
      title: `Ver se abriu: ${o.title}`,
      start: day,
      end: day,
      description: `${o.title} costuma abrir inscrições em ${MONTHS_PT[target - 1]}. Confira se já abriu.\n${more}`,
    };
  }
  return null;
}

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545 line folding: lines longer than 75 octets continue on the next line after a space. */
function fold(line: string): string {
  const bytes = new TextEncoder();
  const out: string[] = [];
  let current = "";
  for (const char of line) {
    if (bytes.encode(current + char).length > (out.length === 0 ? 75 : 74)) {
      out.push(current);
      current = "";
    }
    current += char;
  }
  out.push(current);
  return out.join("\r\n ");
}

const compact = (isoDate: string) => isoDate.replace(/-/g, "");

/** An .ics file with a reminder two days before. */
export function buildIcs(event: CalendarEvent, now: Date): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//oportunidades//pt-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(event.start)}`,
    // DTEND is exclusive for all-day events.
    `DTEND;VALUE=DATE:${compact(addDays(event.end, 1))}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    `URL:${event.url}`,
    ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(event.title)}`,
    "TRIGGER:-P2D",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${compact(event.start)}/${compact(addDays(event.end, 1))}`,
    details: event.description,
  });
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params}`;
}
