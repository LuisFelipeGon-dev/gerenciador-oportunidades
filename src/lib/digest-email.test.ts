import { describe, expect, it } from "vitest";
import type { Digest, DigestItem } from "./digest";
import { digestSubject, renderDigest } from "./digest-email";
import { opportunitySchema, type Opportunity } from "./opportunity";

function entry(overrides: Partial<Opportunity> & { id: string }, distanceKm: number | null = null): DigestItem {
  const { id, ...rest } = overrides;
  const o = opportunitySchema.parse({
    type: "hackathon",
    title: id,
    organizer: null,
    officialUrl: `https://example.com/${id}`,
    modality: "online",
    location: { raw: null, city: null, state: null, country: null, lat: null, lng: null },
    startsOn: null,
    endsOn: null,
    registrationDeadline: "2026-11-20",
    eligibility: { countries: null, minAge: null, studentsOnly: null, levels: null, institutions: null, campuses: null },
    cost: null,
    benefits: [],
    tags: [],
    scale: null,
    source: "devpost",
    sourceId: id,
    verifiedAt: "2026-10-27T12:00:00.000Z",
    status: "open",
    ...rest,
  });
  return { o, distanceKm };
}

const digest = (fresh: number, closing: number, moreFresh = 0): Digest => ({
  fresh: Array.from({ length: fresh }, (_, i) => entry({ id: `f${i}` })),
  moreFresh,
  closing: Array.from({ length: closing }, (_, i) => entry({ id: `c${i}` })),
});

const opts = {
  siteUrl: "https://site.example",
  unsubscribeUrl: "https://site.example/alertas/cancelar?t=abc",
  email: "ana@example.com",
  today: "2026-11-18",
};

describe("digestSubject", () => {
  it.each([
    [3, 2, "3 oportunidades pra você e 2 prazos esta semana"],
    [1, 0, "1 oportunidade pra você"],
    [0, 1, "1 prazo esta semana"],
    [2, 1, "2 oportunidades pra você e 1 prazo esta semana"],
  ])("%i new, %i closing -> %s", (fresh, closing, subject) => {
    expect(digestSubject(digest(fresh, closing))).toBe(subject);
  });
});

describe("renderDigest", () => {
  it("links each item to its page on the site, in HTML and text", () => {
    const d: Digest = { fresh: [entry({ id: "123" })], moreFresh: 0, closing: [] };
    const { html, text } = renderDigest(d, opts);
    expect(html).toContain('href="https://site.example/#o=devpost%3A123"');
    expect(text).toContain("https://site.example/#o=devpost%3A123");
  });

  it("has the unsubscribe link and says who it is for and why", () => {
    const { html, text } = renderDigest(digest(1, 0), opts);
    expect(html).toContain('href="https://site.example/alertas/cancelar?t=abc"');
    expect(text).toContain("https://site.example/alertas/cancelar?t=abc");
    expect(html).toContain("ana@example.com");
    expect(html).toContain("resumo semanal");
  });

  it("escapes titles that come from the sources", () => {
    const d: Digest = { fresh: [entry({ id: "x", title: 'Hack <b>&</b> "IA"' })], moreFresh: 0, closing: [] };
    const { html } = renderDigest(d, opts);
    expect(html).toContain("Hack &lt;b&gt;&amp;&lt;/b&gt; &quot;IA&quot;");
    expect(html).not.toContain("<b>&</b>");
  });

  it("mentions how many more are on the site", () => {
    const { html, text } = renderDigest(digest(10, 0, 2), opts);
    expect(html).toContain("e mais 2 no site");
    expect(text).toContain("e mais 2 no site");
  });

  it("shows the deadline, the place and the distance", () => {
    const d: Digest = {
      fresh: [
        entry(
          { id: "meetup", type: "event", modality: "in_person", registrationDeadline: null, startsOn: "2026-11-15", endsOn: "2026-11-15", location: { raw: null, city: "Várzea Grande", state: "MT", country: "BR", lat: null, lng: null } },
          8.4,
        ),
      ],
      moreFresh: 0,
      closing: [entry({ id: "hack" })],
    };
    const { text } = renderDigest(d, opts);
    expect(text).toContain("acontece em 15/11");
    expect(text).toContain("Várzea Grande, MT · a 8 km");
    expect(text).toContain("fecha em 20/11");
    expect(text).toContain("Online");
  });
});

describe("renderDigest: Topa? layout", () => {
  it("has the Topa? logo as a hosted PNG (Gmail does not show SVG)", () => {
    const { html } = renderDigest(digest(1, 0), opts);
    expect(html).toContain('src="https://site.example/brand/topa-wordmark-dark.png"');
    expect(html).toContain('alt="Topa?"');
  });

  it("gives each item a button to its page and ends with a link to everything", () => {
    const { html } = renderDigest({ fresh: [entry({ id: "123" })], moreFresh: 0, closing: [] }, opts);
    expect(html).toContain("Ver no Topa?");
    expect(html).toContain("Ver tudo no Topa?");
  });

  it("marks deadlines within 3 days as urgent", () => {
    const soon = renderDigest({ fresh: [entry({ id: "a", registrationDeadline: "2026-11-20" })], moreFresh: 0, closing: [] }, opts);
    const later = renderDigest({ fresh: [entry({ id: "b", registrationDeadline: "2026-11-28" })], moreFresh: 0, closing: [] }, opts);
    expect(soon.html).toContain("data-urgent");
    expect(later.html).not.toContain("data-urgent");
  });

  it("has a short preview line for the inbox", () => {
    const { html } = renderDigest(digest(2, 1), opts);
    expect(html).toContain("Separamos o que serve pra você nesta semana.");
  });
});
