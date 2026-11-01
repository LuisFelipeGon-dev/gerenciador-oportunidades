import { describe, expect, it } from "vitest";
import { opportunitySchema, type Opportunity } from "./opportunity";
import { canWatch, dueWatches, opportunityPath, renderOpenedEmail, sourceIdFromSegment } from "./program-alerts";

function program(id: string, status: Opportunity["status"], overrides: Partial<Opportunity> = {}): Opportunity {
  return opportunitySchema.parse({
    type: "ambassador",
    title: `Programa ${id}`,
    organizer: "Empresa <X>",
    officialUrl: `https://example.com/${id}`,
    modality: "online",
    location: { raw: null, city: null, state: null, country: null, lat: null, lng: null },
    startsOn: null,
    endsOn: null,
    registrationDeadline: null,
    eligibility: { countries: null, minAge: null, studentsOnly: null, levels: null, institutions: null, campuses: null },
    cost: null,
    benefits: ["Bolsa"],
    tags: [],
    scale: null,
    source: "curated",
    sourceId: id,
    verifiedAt: "2026-10-27T12:00:00.000Z",
    status,
    ...overrides,
  });
}

describe("canWatch", () => {
  it("is only for curated programs that are not open", () => {
    expect(canWatch(program("a", "closed"))).toBe(true);
    expect(canWatch(program("a", "upcoming"))).toBe(true);
    expect(canWatch(program("a", "open"))).toBe(false);
    expect(canWatch(program("a", "closed", { source: "devpost" }))).toBe(false);
  });
});

describe("dueWatches", () => {
  const programs = [program("open-now", "open"), program("still-closed", "closed")];

  it("returns watches of programs that opened and were not notified yet", () => {
    const due = dueWatches(
      [
        { user_id: "u1", item_key: "curated:open-now", notified_at: null },
        { user_id: "u2", item_key: "curated:open-now", notified_at: "2026-10-30T00:00:00Z" },
        { user_id: "u3", item_key: "curated:still-closed", notified_at: null },
        { user_id: "u4", item_key: "curated:gone", notified_at: null },
      ],
      programs,
    );
    expect(due.map((d) => [d.userId, d.program.sourceId])).toEqual([["u1", "open-now"]]);
  });
});

describe("renderOpenedEmail", () => {
  it("names the program, links to the official page and escapes source text", () => {
    const mail = renderOpenedEmail(program("open-now", "open", { registrationDeadline: "2026-11-20" }), {
      siteUrl: "https://topa.example",
    });
    expect(mail.subject).toBe("Abriu: Programa open-now");
    expect(mail.html).toContain("https://example.com/open-now");
    expect(mail.html).toContain("Empresa &lt;X&gt;");
    expect(mail.html).not.toContain("<X>");
    expect(mail.text).toContain("20/11");
    expect(mail.text).toContain("https://topa.example/o/curated/open-now");
  });
});

describe("opportunityPath", () => {
  it("keeps the id in one segment and reads it back", () => {
    const path = opportunityPath({ source: "unemat", sourceId: "2026/edital 9" });
    expect(path).toBe("/o/unemat/2026~edital%209");
    expect(sourceIdFromSegment(decodeURIComponent(path.split("/")[3]))).toBe("2026/edital 9");
  });
});
