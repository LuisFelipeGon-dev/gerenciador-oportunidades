import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { collectAgendaTech, mapAgendaEvent, parseDatabase } from "./agendatech";

const database = JSON.parse(readFileSync(new URL("./__fixtures__/agendatech-database.json", import.meta.url), "utf8"));
const VERIFIED_AT = "2026-10-30T12:00:00.000Z";

const one = (month: string, event: Record<string, unknown>) => ({
  eventos: [{ ano: 2026, arquivado: false, meses: [{ mes: month, arquivado: false, eventos: [event] }] }],
});

describe("parseDatabase", () => {
  it("reads every dated event with its first and last day", () => {
    const events = parseDatabase(database);
    expect(events).toHaveLength(13);
    expect(events.find((e) => e.name === "GambiConf 2026")).toEqual({
      name: "GambiConf 2026",
      url: "https://gambiconf.dev/",
      city: "São Paulo",
      state: "SP",
      kind: "híbrido",
      startsOn: "2026-11-28",
      endsOn: "2026-11-29",
    });
  });

  it("ends in the next month when the days wrap around (30, 31, 01)", () => {
    const [e] = parseDatabase(one("outubro", { nome: "Virada", data: ["30", "31", "01"], url: "https://virada.dev", cidade: "Recife", uf: "PE", tipo: "presencial" }));
    expect(e).toMatchObject({ startsOn: "2026-10-30", endsOn: "2026-11-01" });
  });

  it("skips entries that are not events (a badge image as link, no days, unknown month)", () => {
    expect(parseDatabase(one("outubro", { nome: "Ignite Lab", data: ["10"], url: "https://img.shields.io/static/v1?label=&message=online", cidade: "", uf: "", tipo: "online" }))).toEqual([]);
    expect(parseDatabase(one("outubro", { nome: "Sem dia", data: [], url: "https://x.dev", cidade: "", uf: "", tipo: "online" }))).toEqual([]);
    expect(parseDatabase(one("brumário", { nome: "X", data: ["01"], url: "https://x.dev", cidade: "", uf: "", tipo: "online" }))).toEqual([]);
  });

  it("fails loudly when the file format changes", () => {
    expect(() => parseDatabase({ events: [] })).toThrow();
  });
});

describe("mapAgendaEvent", () => {
  const events = parseDatabase(database);
  const jsconf = events.find((e) => e.name === "JSConf Brasil 2026")!;

  it("maps an in-person conference", () => {
    expect(mapAgendaEvent(jsconf, VERIFIED_AT)).toMatchObject({
      type: "event",
      title: "JSConf Brasil 2026",
      organizer: null,
      officialUrl: "https://jsconf.com.br/",
      modality: "in_person",
      location: { raw: "São Caetano Do Sul/SP", city: "São Caetano Do Sul", state: "SP", country: "BR" },
      startsOn: "2026-11-28",
      endsOn: "2026-11-28",
      registrationDeadline: null,
      scale: "national",
      source: "agendatech",
      sourceId: "2026-11-28-jsconf-brasil-2026",
      status: "open",
    });
  });

  it("maps hybrid and online events", () => {
    expect(mapAgendaEvent(events.find((e) => e.name === "GambiConf 2026")!, VERIFIED_AT).modality).toBe("hybrid");
    const [online] = parseDatabase(one("novembro", { nome: "Live de Python", data: ["03"], url: "https://live.dev", cidade: "", uf: "", tipo: "online" }));
    expect(mapAgendaEvent(online, VERIFIED_AT)).toMatchObject({ modality: "online", location: { city: null, state: null, country: "BR" } });
  });
});

describe("collectAgendaTech", () => {
  it("keeps events that have not ended yet", async () => {
    const result = await collectAgendaTech({ verifiedAt: VERIFIED_AT, fetchJson: async () => database });
    expect(result.opportunities.map((o) => o.title)).toEqual([
      "DevFest Porto Alegre 2026",
      "PlatformCon São Paulo",
      "MVP CONF REGIONAL FLORIANÓPOLIS",
      "TDC Experience Recife | Rec'n'Play",
      "Front in Floripa",
      "JSConf Brasil 2026",
      "GambiConf 2026",
      "TDCX PORTO ALEGRE",
    ]);
    expect(result.skipped).toBe(5);
  });
});
