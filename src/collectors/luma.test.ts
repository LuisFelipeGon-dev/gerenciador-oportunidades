import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { MunicipalityTable } from "../lib/geo";
import { collectLuma, loadCalendars, mapLumaEvent, parseCalendars, parseIcs, type LumaCalendar } from "./luma";

const fixture = (name: string) =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");
const hackbr = fixture("luma-hackbr.ics");
const gama = fixture("luma-gamahouse.ics");
const tdc = fixture("luma-tdc-recife.ics");
const VERIFIED_AT = "2026-10-28T12:00:00.000Z";

const TABLE: MunicipalityTable = {
  SP: [["São Paulo", -23.5329, -46.6395, 1]],
  PE: [["Recife", -8.0476, -34.877, 1]],
};

const calendar = (overrides: Partial<LumaCalendar> = {}): LumaCalendar => ({
  id: "cal-XwtEMwMvmBXhsrH",
  name: "Hack Brasil",
  url: "https://luma.com/hackbr",
  why: "teste",
  checked_on: "2026-10-28",
  ...overrides,
});

describe("data/luma-calendars.yaml", () => {
  it("is valid", async () => {
    expect((await loadCalendars()).length).toBeGreaterThan(0);
  });
});

describe("parseCalendars", () => {
  it("rejects ids that are not Luma calendars", () => {
    expect(() => parseCalendars("- id: hackbr\n  name: X\n  url: https://luma.com/x\n  why: y\n  checked_on: 2026-10-28\n")).toThrow();
  });
});

describe("parseIcs", () => {
  it("unfolds long lines and unescapes text", () => {
    const [opening, launch] = parseIcs(hackbr);
    expect(opening).toMatchObject({
      uid: "evt-HguKQn6Kzb5vGgO@events.lu.ma",
      summary: "Hack Brasil · Sessão de abertura (ao vivo)",
      start: "2026-11-04T22:00:00Z",
      end: "2026-11-05T00:00:00Z",
      geo: null,
    });
    expect(opening.description).toContain("https://luma.com/a1s82qkw\n\nOrganizado por");
    expect(launch.geo).toEqual({ lat: -23.5642011, lng: -46.6525289 });
    expect(launch.location).toBe("Av. Paulista, 1106 - Bela Vista, São Paulo - SP, 01310-100, Brasil");
  });

  it("fails on something that is not a calendar", () => {
    expect(() => parseIcs("<html></html>")).toThrow();
  });
});

describe("mapLumaEvent", () => {
  const [opening, launch] = parseIcs(hackbr);

  it("maps an in-person event to the nearest city, with the Luma page as the official link", () => {
    expect(mapLumaEvent(launch, calendar(), TABLE, VERIFIED_AT)).toMatchObject({
      type: "hackathon",
      title: "Hack Brasil · Encontro de lançamento em São Paulo",
      organizer: "Hack Brasil",
      officialUrl: "https://luma.com/11obbloe",
      modality: "in_person",
      location: { city: "São Paulo", state: "SP", country: "BR", lat: -23.5642011, lng: -46.6525289 },
      startsOn: "2026-11-05",
      source: "luma",
      sourceId: "evt-7h7mwMFwJtJhCWC",
    });
  });

  it("treats events without coordinates as online", () => {
    expect(mapLumaEvent(opening, calendar(), TABLE, VERIFIED_AT)).toMatchObject({
      modality: "online",
      location: { city: null, country: null, lat: null },
      startsOn: "2026-11-04",
    });
  });

  it("uses the local date in Brazil, not the UTC one", () => {
    // 22:00 UTC on Nov 4 is 19:00 in Brasília, still Nov 4; 02:00 UTC on Nov 5 is Nov 4 in Brazil.
    const late = { ...opening, start: "2026-11-05T02:00:00Z", end: "2026-11-05T03:00:00Z" };
    expect(mapLumaEvent(late, calendar(), TABLE, VERIFIED_AT).startsOn).toBe("2026-11-04");
  });

  it("calls events that are not hackathons events", () => {
    const [talk] = parseIcs(tdc).slice(-1);
    expect(mapLumaEvent(talk, calendar({ name: "TDC Recife" }), TABLE, VERIFIED_AT)).toMatchObject({
      type: "event",
      location: { city: "Recife", state: "PE" },
    });
  });
});

describe("collectLuma", () => {
  const feeds: Record<string, string> = {
    "cal-XwtEMwMvmBXhsrH": hackbr,
    "cal-wU90pJjb6H1p9G9": gama,
    "cal-8vjlp1OuJKaJSan": tdc,
  };
  const fetchText = async (url: string) => feeds[new URL(url).searchParams.get("id")!] ?? "";
  const calendars = [
    calendar(),
    calendar({ id: "cal-wU90pJjb6H1p9G9", name: "Gama House", only_matching: "hack" }),
    calendar({ id: "cal-8vjlp1OuJKaJSan", name: "TDC Recife" }),
  ];

  it("keeps future events in Brazil or online, filtered by title when the calendar asks", async () => {
    const { opportunities } = await collectLuma({ verifiedAt: VERIFIED_AT, fetchText, calendars, municipalities: TABLE });
    expect(opportunities.map((o) => o.title)).toEqual([
      "Hack Brasil · Sessão de abertura (ao vivo)",
      "Hack Brasil · Encontro de lançamento em São Paulo",
      "Shiva Hack #9 – Empowering Women w/ Endeavor + Sororitê",
      "Pré-inscrição TDC Stage + Rec'n'play",
    ]);
  });

  it("leaves out in-person events abroad", async () => {
    const abroad = hackbr.replace("GEO:-23.5642011;-46.6525289", "GEO:40.705202;-74.013166");
    const { opportunities, skipped } = await collectLuma({
      verifiedAt: VERIFIED_AT,
      fetchText: async () => abroad,
      calendars: [calendar()],
      municipalities: TABLE,
    });
    expect(opportunities.map((o) => o.modality)).toEqual(["online"]);
    expect(skipped).toBe(1);
  });

  it("fails when every feed is unreadable", async () => {
    await expect(
      collectLuma({ verifiedAt: VERIFIED_AT, fetchText: async () => "<html></html>", calendars, municipalities: TABLE }),
    ).rejects.toThrow();
  });
});
