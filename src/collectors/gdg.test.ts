import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  chapterForEventUrl,
  collectGdg,
  eventSitemapUrls,
  mapGdgEvent,
  parseGdgEventPage,
  parseSitemapLocs,
} from "./gdg";
import { GDG_CHAPTERS_BR } from "./gdg-chapters-br";

const fixture = (name: string) =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");
const sitemap = fixture("gdg-sitemap-events.xml");
const eventPage = fixture("gdg-event-devfest-cerrado.html");
const VERIFIED_AT = "2026-10-27T12:00:00.000Z";
const EVENT_URL =
  "https://gdg.community.dev/events/details/google-gdg-goiania-presents-devfest-cerrado-2026/";
const goiania = GDG_CHAPTERS_BR.find((c) => c.slug === "gdg-goiania")!;

describe("eventSitemapUrls", () => {
  it("covers this month and the next two, across the year boundary", () => {
    expect(eventSitemapUrls("2026-11-15")).toEqual([
      "https://gdg.community.dev/sitemap-events-2026-11.xml",
      "https://gdg.community.dev/sitemap-events-2026-12.xml",
      "https://gdg.community.dev/sitemap-events-2027-01.xml",
    ]);
  });
});

describe("sitemap filtering", () => {
  it("keeps only events from Brazilian chapters", () => {
    const matched = parseSitemapLocs(sitemap)
      .map((loc) => chapterForEventUrl(loc, GDG_CHAPTERS_BR)?.slug)
      .filter(Boolean);
    expect(matched.sort()).toEqual(["gdg-belem", "gdg-cloud-sao-paulo", "gdg-goiania", "gdg-rio-de-janeiro"]);
  });

  it("does not confuse chapters that share a prefix", () => {
    const chapters = [
      { slug: "gdg-sao-jose-do-rio-preto", name: "A", city: "A", state: "SP" },
      { slug: "gdg-sao-jose-dos-campos", name: "B", city: "B", state: "SP" },
    ];
    const url = "https://gdg.community.dev/events/details/google-gdg-sao-jose-dos-campos-presents-io/";
    expect(chapterForEventUrl(url, chapters)?.name).toBe("B");
  });

  it("fails on a document that is not a sitemap", () => {
    expect(() => parseSitemapLocs("<html></html>")).toThrow();
  });
});

describe("mapGdgEvent", () => {
  it("maps an in-person DevFest", () => {
    const o = mapGdgEvent(parseGdgEventPage(eventPage), EVENT_URL, goiania, VERIFIED_AT);
    expect(o).toMatchObject({
      type: "event",
      title: "DevFest Cerrado 2026",
      organizer: "GDG Goiânia",
      officialUrl: EVENT_URL,
      modality: "in_person",
      location: { raw: "Equatore Eventos, Goiânia", city: "Goiânia", state: "GO", country: "BR" },
      startsOn: "2026-11-28",
      endsOn: "2026-11-28",
      tags: ["GDG", "DevFest"],
      source: "gdg",
      sourceId: "google-gdg-goiania-presents-devfest-cerrado-2026",
      status: "open",
    });
  });

  it("maps online and cancelled events", () => {
    const ld = {
      ...parseGdgEventPage(eventPage),
      eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
      eventStatus: "https://schema.org/EventCancelled",
      location: undefined,
    };
    const o = mapGdgEvent(ld, EVENT_URL, goiania, VERIFIED_AT);
    expect(o.modality).toBe("online");
    expect(o.location.city).toBeNull();
    expect(o.status).toBe("closed");
  });

  it("fails on a page without an Event", () => {
    expect(() => parseGdgEventPage("<html><head></head></html>")).toThrow();
  });
});

describe("collectGdg", () => {
  it("fetches sitemaps, then only the matching event pages", async () => {
    const urls: string[] = [];
    const { opportunities, skipped } = await collectGdg({
      verifiedAt: VERIFIED_AT,
      chapters: [goiania],
      fetchText: async (url) => {
        urls.push(url);
        return url.includes("sitemap") ? sitemap : eventPage;
      },
    });
    expect(urls.filter((u) => u.includes("sitemap"))).toHaveLength(3);
    expect(urls.filter((u) => u.includes("/events/details/"))).toEqual([EVENT_URL]);
    expect(opportunities).toHaveLength(1);
    expect(skipped).toBe(0);
  });

  it("fails when every event page breaks", async () => {
    const run = (page: string) =>
      collectGdg({
        verifiedAt: VERIFIED_AT,
        chapters: [goiania],
        fetchText: async (url) => (url.includes("sitemap") ? sitemap : page),
      });
    await expect(run("<html></html>")).rejects.toThrow(/failed to parse/);
  });

  it("fails when the sitemaps are empty", async () => {
    const empty = '<?xml version="1.0"?><urlset></urlset>';
    await expect(
      collectGdg({ verifiedAt: VERIFIED_AT, fetchText: async () => empty }),
    ).rejects.toThrow(/no events/);
  });
});
