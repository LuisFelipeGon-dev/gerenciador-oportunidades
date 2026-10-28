import { describe, expect, it } from "vitest";
import { buildIcs, calendarEventFor, googleCalendarUrl } from "./calendar";
import { opportunitySchema } from "./opportunity";

const base = opportunitySchema.parse({
  type: "hackathon",
  title: "PayPal AI Hackathon",
  organizer: "PayPal",
  officialUrl: "https://paypalaihackathon.devpost.com/",
  modality: "online",
  location: { raw: null, city: null, state: null, country: null, lat: null, lng: null },
  startsOn: "2026-10-01",
  endsOn: "2026-11-12",
  registrationDeadline: "2026-11-12",
  eligibility: { countries: null, minAge: null, studentsOnly: null, levels: null },
  cost: null,
  benefits: [],
  tags: [],
  scale: null,
  source: "devpost",
  sourceId: "31302",
  verifiedAt: "2026-10-27T12:00:00.000Z",
  status: "open",
});
const SITE = "https://gerenciador-oportunidades.vercel.app/#o=devpost:31302";

describe("calendarEventFor", () => {
  it("uses the registration deadline when there is one", () => {
    expect(calendarEventFor(base, SITE, "2026-10-27")).toMatchObject({
      title: "Prazo: PayPal AI Hackathon",
      start: "2026-11-12",
      end: "2026-11-12",
    });
  });

  it("uses the event days when there is no deadline", () => {
    const event = { ...base, registrationDeadline: null, startsOn: "2026-12-04", endsOn: "2026-12-05" };
    expect(calendarEventFor(event, SITE, "2026-10-27")).toMatchObject({ start: "2026-12-04", end: "2026-12-05" });
  });

  it("reminds about the month a closed program usually opens, next year when it has passed", () => {
    const program = {
      ...base,
      type: "ambassador" as const,
      registrationDeadline: null,
      startsOn: null,
      endsOn: null,
      status: "closed" as const,
      typicalOpenMonths: [7],
    };
    expect(calendarEventFor(program, SITE, "2026-10-27")?.start).toBe("2027-07-01");
    expect(calendarEventFor({ ...program, typicalOpenMonths: [12] }, SITE, "2026-10-27")?.start).toBe("2026-12-01");
  });
});

describe("buildIcs", () => {
  const ics = buildIcs(calendarEventFor(base, SITE, "2026-10-27")!, new Date("2026-10-27T15:04:05.678Z"));

  it("is an all-day event with an exclusive end and a reminder two days before", () => {
    expect(ics).toContain("DTSTART;VALUE=DATE:20261112\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20261113\r\n");
    expect(ics).toContain("TRIGGER:-P2D\r\n");
    expect(ics).toContain("DTSTAMP:20261027T150405Z\r\n");
  });

  it("escapes text and folds long lines", () => {
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics).not.toMatch(/DESCRIPTION:[^\r]*\n(?! )/);
  });
});

describe("googleCalendarUrl", () => {
  it("builds a template link with the same dates", () => {
    const url = new URL(googleCalendarUrl(calendarEventFor(base, SITE, "2026-10-27")!));
    expect(url.searchParams.get("dates")).toBe("20261112/20261113");
    expect(url.searchParams.get("text")).toBe("Prazo: PayPal AI Hackathon");
  });
});
