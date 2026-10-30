import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { collectSbc, mapSbcEvent, parseEventsPage, placeOf } from "./sbc";

const page = JSON.parse(readFileSync(new URL("./__fixtures__/sbc-events.json", import.meta.url), "utf8"));
const VERIFIED_AT = "2026-10-30T12:00:00.000Z";
const events = parseEventsPage(page).events;
const byTitle = (part: string) => events.find((e) => e.title.includes(part))!;

describe("placeOf", () => {
  it.each([
    ["Várzea Grande/MT", { city: "Várzea Grande", state: "MT" }],
    ["Natal / RN", { city: "Natal", state: "RN" }],
    ["Hotel Praia Brava &#8211; Praia Brava/SC", { city: "Praia Brava", state: "SC" }],
    ["Centro de Convenções - Natal/RN", { city: "Natal", state: "RN" }],
    ["Online", { city: null, state: null }],
    ["", { city: null, state: null }],
  ])("%s", (venue, place) => {
    expect(placeOf(venue)).toEqual(place);
  });
});

describe("mapSbcEvent", () => {
  it("maps ERI-MT 2026, a regional school run by the SBC", () => {
    expect(mapSbcEvent(byTitle("ERI-MT"), VERIFIED_AT)).toMatchObject({
      type: "event",
      title: "XV Escola Regional de Informática de Mato Grosso (ERI-MT 2026)",
      organizer: "Sociedade Brasileira de Computação",
      officialUrl: "http://www.sbc.org.br/erimt2026",
      modality: "in_person",
      location: { raw: "Várzea Grande/MT", city: "Várzea Grande", state: "MT", country: "BR" },
      startsOn: "2026-11-10",
      endsOn: "2026-11-12",
      registrationDeadline: null,
      scale: "regional",
      tags: ["SBC"],
      source: "sbc",
      sourceId: String(byTitle("ERI-MT").id),
      status: "open",
    });
  });

  it("decodes the title and keeps the organizer empty for events the SBC only supports", () => {
    const o = mapSbcEvent(byTitle("Maratona SBC"), VERIFIED_AT);
    expect(o.title).toBe("31ª Maratona SBC de Programação 2026 – Final Brasileira em Uberlândia");
    expect(o.scale).toBe("national");
    const supported = mapSbcEvent(byTitle("SEFITEL"), VERIFIED_AT);
    expect(supported.organizer).toBeNull();
  });

  it("reads hybrid events from the category", () => {
    expect(mapSbcEvent(byTitle("Santos Dumont"), VERIFIED_AT).modality).toBe("hybrid");
  });
});

describe("collectSbc", () => {
  it("asks for events from today on and keeps each event once", async () => {
    const urls: string[] = [];
    const result = await collectSbc({
      verifiedAt: VERIFIED_AT,
      fetchJson: async (url) => {
        urls.push(url);
        return page;
      },
    });
    expect(urls).toEqual(["https://www.sbc.org.br/wp-json/tribe/events/v1/events?per_page=50&page=1&start_date=2026-10-30"]);
    // UCC 2026 is listed twice (as supported and as partner), with the same site and dates.
    expect(result.opportunities.filter((o) => o.officialUrl === "https://ucc-conference.org/")).toHaveLength(1);
    expect(result.opportunities).toHaveLength(30);
    expect(result.skipped).toBe(1);
  });

  it("reads the next pages when there are more", async () => {
    const pages: string[] = [];
    await collectSbc({
      verifiedAt: VERIFIED_AT,
      fetchJson: async (url) => {
        pages.push(new URL(url).searchParams.get("page")!);
        return { ...page, total_pages: 2 };
      },
    });
    expect(pages).toEqual(["1", "2"]);
  });

  it("fails loudly when the API format changes", async () => {
    await expect(collectSbc({ verifiedAt: VERIFIED_AT, fetchJson: async () => ({ items: [] }) })).rejects.toThrow();
  });
});
