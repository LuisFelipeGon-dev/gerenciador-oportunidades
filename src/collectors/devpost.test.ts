import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  collectDevpost,
  mapDevpostHackathon,
  parseDevpostPage,
  parseSubmissionPeriod,
} from "./devpost";

const fixture = JSON.parse(
  readFileSync(new URL("./__fixtures__/devpost-open-page2.json", import.meta.url), "utf8"),
);
const VERIFIED_AT = "2026-10-27T12:00:00.000Z";

describe("parseSubmissionPeriod", () => {
  it.each([
    ["Oct 06 - 31, 2026", "2026-10-06", "2026-10-31"],
    ["Aug 26 - Oct 30, 2026", "2026-08-26", "2026-10-30"],
    ["Jul 16, 2026 - Jan 15, 2027", "2026-07-16", "2027-01-15"],
    ["Dec 20 - Jan 05, 2027", "2026-12-20", "2027-01-05"],
    ["Oct 30, 2026", "2026-10-30", "2026-10-30"],
  ])("%s", (text, start, end) => {
    expect(parseSubmissionPeriod(text)).toEqual({ start, end });
  });

  it("returns null for unknown formats", () => {
    expect(parseSubmissionPeriod("Rolling")).toBeNull();
    expect(parseSubmissionPeriod("Foo 01 - 02, 2026")).toBeNull();
  });
});

describe("mapDevpostHackathon", () => {
  const page = parseDevpostPage(fixture);
  const byId = (id: number) => page.hackathons.find((h) => h.id === id)!;

  it("maps an online hackathon", () => {
    const o = mapDevpostHackathon(byId(30740), VERIFIED_AT)!;
    expect(o).toMatchObject({
      type: "hackathon",
      title: "Code for Humanity",
      officialUrl: expect.stringMatching(/^https:\/\//),
      modality: "online",
      startsOn: "2026-07-16",
      endsOn: "2027-01-15",
      registrationDeadline: "2027-01-15",
      source: "devpost",
      sourceId: "30740",
      verifiedAt: VERIFIED_AT,
      status: "open",
    });
    expect(o.location.raw).toBeNull();
  });

  it("keeps the location text of an in-person hackathon", () => {
    const o = mapDevpostHackathon(byId(31694), VERIFIED_AT)!;
    expect(o.modality).toBe("in_person");
    expect(o.location.raw).toBe("SSM cultural centre");
  });

  it("removes HTML from the prize amount", () => {
    const o = mapDevpostHackathon(byId(30500), VERIFIED_AT)!;
    for (const b of o.benefits) expect(b).not.toMatch(/[<>]/);
  });

  it("drops placeholder organizer names", () => {
    // "Code for Humanity" comes with organization_name "nill".
    expect(mapDevpostHackathon(byId(30740), VERIFIED_AT)!.organizer).toBeNull();
    for (const placeholder of ["null", "N/A", "none", "-", "TBD"]) {
      expect(mapDevpostHackathon({ ...byId(30740), organization_name: placeholder }, VERIFIED_AT)!.organizer).toBeNull();
    }
    expect(mapDevpostHackathon(byId(31474), VERIFIED_AT)!.organizer).toBe("CodeTheCure");
  });

  it("skips invite-only hackathons", () => {
    expect(mapDevpostHackathon({ ...byId(30740), invite_only: true }, VERIFIED_AT)).toBeNull();
  });
});

describe("collectDevpost", () => {
  it("walks every page reported by meta and maps all items", async () => {
    const urls: string[] = [];
    const pageSize = fixture.hackathons.length;
    const result = await collectDevpost({
      verifiedAt: VERIFIED_AT,
      fetchJson: async (url) => {
        urls.push(url);
        return { ...fixture, meta: { ...fixture.meta, total_count: pageSize * 2, per_page: pageSize } };
      },
    });

    expect(urls).toHaveLength(2);
    expect(urls[1]).toContain("page=2");
    expect(result.opportunities).toHaveLength(pageSize * 2);
    expect(result.skipped).toBe(0);
  });

  it("fails when the response shape changes", async () => {
    await expect(
      collectDevpost({ verifiedAt: VERIFIED_AT, fetchJson: async () => ({ items: [] }) }),
    ).rejects.toThrow();
  });
});
