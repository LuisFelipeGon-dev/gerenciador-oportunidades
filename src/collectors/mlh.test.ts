import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { collectMlh, mapMlhEvent, mlhSeason, parseMlhSeasonPage } from "./mlh";

const html = readFileSync(new URL("./__fixtures__/mlh-season-2027.html", import.meta.url), "utf8");
const VERIFIED_AT = "2026-10-27T12:00:00.000Z";

describe("mlhSeason", () => {
  it.each([
    ["2026-07-31", 2026],
    ["2026-08-01", 2027],
    ["2026-10-27T12:00:00.000Z", 2027],
    ["2027-03-10", 2027],
  ])("%s -> %i", (date, season) => {
    expect(mlhSeason(date)).toBe(season);
  });
});

describe("parseMlhSeasonPage", () => {
  it("reads the events embedded in the page", () => {
    expect(parseMlhSeasonPage(html)).toHaveLength(6);
  });

  it("fails when the page structure changes", () => {
    expect(() => parseMlhSeasonPage("<html><body>nada</body></html>")).toThrow();
  });
});

describe("mapMlhEvent", () => {
  const events = parseMlhSeasonPage(html);
  const bySlug = (prefix: string) => events.find((e) => e.slug.startsWith(prefix))!;

  it("maps an in-person hackathon with its address", () => {
    const o = mapMlhEvent(bySlug("hackcbs"), VERIFIED_AT);
    expect(o).toMatchObject({
      type: "hackathon",
      title: "hackCBS 9.O",
      officialUrl: "https://hackcbs.tech",
      modality: "in_person",
      location: { city: "New delhi", state: "New delhi", country: "IN" },
      startsOn: "2026-10-31",
      endsOn: "2026-11-01",
      registrationDeadline: null,
      source: "mlh",
    });
  });

  it("maps hybrid events", () => {
    expect(mapMlhEvent(bySlug("makeuc"), VERIFIED_AT).modality).toBe("hybrid");
  });

  it("trims names with trailing spaces", () => {
    expect(mapMlhEvent(bySlug("ugahacks"), VERIFIED_AT).title).toBe("UGAHacks");
  });

  it("falls back to the MLH page when there is no website", () => {
    const o = mapMlhEvent({ ...bySlug("junction"), websiteUrl: null }, VERIFIED_AT);
    expect(o.officialUrl).toMatch(/^https:\/\/www\.mlh\.com\/events\//);
  });

  it("adds the protocol to bare websites and ignores invalid ones", () => {
    const base = bySlug("junction");
    expect(mapMlhEvent({ ...base, websiteUrl: "junction.fi" }, VERIFIED_AT).officialUrl).toBe(
      "https://junction.fi",
    );
    expect(mapMlhEvent({ ...base, websiteUrl: "javascript:alert(1)" }, VERIFIED_AT).officialUrl).toMatch(
      /^https:\/\/www\.mlh\.com\//,
    );
  });
});

describe("collectMlh", () => {
  it("requests the current season page", async () => {
    const urls: string[] = [];
    const { opportunities } = await collectMlh({
      verifiedAt: VERIFIED_AT,
      fetchText: async (url) => {
        urls.push(url);
        return html;
      },
    });
    expect(urls).toEqual(["https://www.mlh.com/seasons/2027/events"]);
    expect(opportunities).toHaveLength(6);
  });
});
