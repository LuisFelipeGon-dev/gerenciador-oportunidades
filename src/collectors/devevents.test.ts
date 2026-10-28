import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { MunicipalityTable } from "../lib/geo";
import { collectDevEvents, mapDevEvent, officialUrlFromPage, parseListing } from "./devevents";

const fixture = (name: string) =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");
const listing = fixture("devevents-br.html");
const gambiPage = fixture("devevents-event-gambiconf.html");
const nortaoPage = fixture("devevents-event-devfest-nortao.html");
const VERIFIED_AT = "2026-10-28T12:00:00.000Z";

const TABLE: MunicipalityTable = {
  SP: [["São Paulo", -23.5329, -46.6395, 1]],
  MT: [["Sinop", -11.8604, -55.5091]],
  PA: [["Belém", -1.4554, -48.4898, 1]],
  PB: [["Belém", -6.6917, -35.5333]],
};

describe("parseListing", () => {
  const events = parseListing(listing);

  it("reads every event of the page", () => {
    expect(events).toHaveLength(22);
  });

  it("keeps name, dates, attendance mode, city and the dev.events page", () => {
    expect(events.find((e) => e.name === "GambiConf 2026")).toMatchObject({
      startDate: "2026-11-28T00:00:00.000+00:00",
      endDate: "2026-11-29T00:00:00.000+00:00",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      location: { address: { addressLocality: "Sao Paulo" } },
      url: "https://dev.events/conferences/gambi-conf-2026-knyqphfg",
    });
  });

  it("fails on a page without events", () => {
    expect(() => parseListing("<html></html>")).toThrow();
  });
});

describe("officialUrlFromPage", () => {
  it("uses the embedded website", () => {
    expect(officialUrlFromPage(gambiPage)).toBe("https://gambiconf.dev");
  });

  it("falls back to the Visit link when the site cannot be embedded", () => {
    expect(officialUrlFromPage(nortaoPage)).toBe(
      "https://gdg.community.dev/events/details/google-gdg-sinop-presents-devfest-nortao-2026",
    );
  });

  it("returns null when there is no link", () => {
    expect(officialUrlFromPage("<html></html>")).toBeNull();
  });
});

describe("mapDevEvent", () => {
  const gambi = parseListing(listing).find((e) => e.name === "GambiConf 2026")!;

  it("maps an in-person event in Brazil, with the state found from the city", () => {
    expect(mapDevEvent(gambi, "https://gambiconf.dev", TABLE, VERIFIED_AT)).toMatchObject({
      type: "event",
      title: "GambiConf 2026",
      officialUrl: "https://gambiconf.dev",
      modality: "in_person",
      location: { raw: "Sao Paulo, Brazil", city: "Sao Paulo", state: "SP", country: "BR" },
      startsOn: "2026-11-28",
      endsOn: "2026-11-29",
      source: "devevents",
      sourceId: "gambi-conf-2026-knyqphfg",
      status: "open",
    });
  });

  it("leaves the state empty when the city is not found", () => {
    const pituacu = parseListing(listing).find((e) => e.name === "DevOpsDays Salvador 2026")!;
    expect(mapDevEvent(pituacu, "https://devopsdays.org/", TABLE, VERIFIED_AT).location).toMatchObject({
      city: "Pituacu",
      state: null,
      country: "BR",
    });
  });
});

describe("collectDevEvents", () => {
  it("keeps in-person and hybrid events, skips GDG duplicates and events without an official link", async () => {
    const requested: string[] = [];
    const fetchText = async (url: string) => {
      requested.push(url);
      if (url === "https://dev.events/SA/BR") return listing;
      if (url.endsWith("gambi-conf-2026-knyqphfg")) return gambiPage;
      if (url.endsWith("dev-fest-nortao-2026-mato-grosso-lthtv-5g")) return nortaoPage;
      return "<html></html>";
    };
    const { opportunities, skipped } = await collectDevEvents({ verifiedAt: VERIFIED_AT, fetchText, municipalities: TABLE });

    expect(opportunities.map((o) => o.title)).toEqual(["GambiConf 2026"]);
    // 20 in-person/hybrid events: GambiConf kept, the DevFest is a GDG event, 18 pages without a link.
    expect(skipped).toBe(19);
    expect(requested.some((u) => u.includes("principal-developer-online"))).toBe(false);
  });

  it("fails when every event page is unreadable", async () => {
    const fetchText = async (url: string) => (url === "https://dev.events/SA/BR" ? listing : "<html></html>");
    await expect(collectDevEvents({ verifiedAt: VERIFIED_AT, fetchText, municipalities: TABLE })).rejects.toThrow();
  });
});
