import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { collectIfmt, ifmtTerms, mapIfmtEdital, parseIfmtPage, type IfmtPost } from "./ifmt";

const page = JSON.parse(readFileSync(new URL("./__fixtures__/ifmt-editais.json", import.meta.url), "utf8"));
const posts = parseIfmtPage(page);
const byId = (id: number) => posts.find((p) => p.id === id)!;
/** A post as it read while inscriptions were open: before the paragraphs with results were added. */
const beforeResults = (post: IfmtPost): IfmtPost => {
  const html = post.content.rendered;
  const at = html.search(/<p>[^\n]*resultado/i);
  return { ...post, content: { rendered: at >= 0 ? html.slice(0, at) : html } };
};
const AUXILIO_24 = 35372; // Edital 24/2026 – Auxílio alimentação (Alta Floresta)
const ESTAGIO_226 = 36288; // Edital 226/2026 – Processo Seletivo de Estágio Reitoria IFMT
const BOLSISTAS_39 = 36386; // Edital Nº 39/2026 – bolsistas de extensão, Cáceres

describe("ifmtTerms", () => {
  it("reads levels, units and the internship area from the post classes", () => {
    expect(ifmtTerms(byId(AUXILIO_24).class_list)).toEqual({ levels: ["undergraduate"], units: ["Alta Floresta"], internship: false, area: "Assistência estudantil" });
    expect(ifmtTerms(byId(ESTAGIO_226).class_list)).toMatchObject({ levels: ["undergraduate"], units: [], internship: true });
    expect(ifmtTerms(["publico-alvo-edital-estudante-pos-graduacao", "unidade-edital-cuiaba-octayde", "unidade-edital-rtr"])).toMatchObject({
      levels: ["graduate", "phd"],
      units: ["Cuiabá - Octayde", "Reitoria"],
    });
  });
});

describe("mapIfmtEdital", () => {
  it("maps Edital 24/2026 with what the post says", () => {
    const o = mapIfmtEdital(beforeResults(byId(AUXILIO_24)), "2026-09-30T12:00:00.000Z")!;
    expect(o).toMatchObject({
      type: "scholarship",
      title: "Edital 24/2026 – Auxílio alimentação",
      organizer: "IFMT · Alta Floresta",
      officialUrl: byId(AUXILIO_24).link,
      modality: "in_person",
      location: { city: "Alta Floresta", state: "MT", country: "BR" },
      registrationDeadline: "2026-10-02",
      eligibility: { institutions: ["IFMT"], campuses: ["Alta Floresta"], levels: ["undergraduate"], studentsOnly: true },
      benefits: ["Bolsa de R$ 400,00"],
      tags: ["Edital IFMT", "Assistência estudantil"],
      source: "ifmt",
      sourceId: String(AUXILIO_24),
    });
    expect(o.summary?.startsWith("O IFMT – Campus Alta Floresta torna público o Edital nº 24/2026")).toBe(true);
    expect(o.note).toBe("Lido automaticamente da página do edital: confira datas e requisitos no edital.");
  });

  it("drops it once the inscription period is over", () => {
    expect(mapIfmtEdital(beforeResults(byId(AUXILIO_24)), "2026-10-29T12:00:00.000Z")).toBeNull();
  });

  it("maps a Reitoria internship for every campus, in Cuiabá, with decoded title", () => {
    const o = mapIfmtEdital(byId(ESTAGIO_226), "2026-10-27T12:00:00.000Z")!;
    expect(o.type).toBe("internship");
    expect(o.title).toBe("Edital 226/2026 – Processo Seletivo de Estágio Reitoria IFMT");
    expect(o.eligibility.campuses).toBeNull();
    expect(o.location.city).toBe("Cuiabá");
    expect(o.benefits).toEqual(["Bolsa-estágio de R$ 1.508,42"]);
  });

  it("keeps high-school calls for high-school students", () => {
    const o = mapIfmtEdital(byId(BOLSISTAS_39), "2026-10-29T12:00:00.000Z")!;
    expect(o.eligibility).toMatchObject({ levels: ["high_school"], campuses: ["Cáceres"] });
  });

  it("takes the campus from the text when the post has no unit tag", () => {
    // "Abertas inscrições para vagas remanescentes…": "… do IFMT Campus Várzea Grande …".
    const o = mapIfmtEdital(byId(36322), "2026-10-29T12:00:00.000Z")!;
    expect(o.eligibility.campuses).toEqual(["Várzea Grande"]);
    expect(o.location.city).toBe("Várzea Grande");
  });

  it("drops calls whose post already shows the final result", () => {
    // Edital 18/2026 (Barra do Garças): "Resultado Final Resultado Preliminar …".
    expect(mapIfmtEdital(byId(35665), "2026-10-03T12:00:00.000Z")).toBeNull();
  });

  it("does not take a list of links as the summary", () => {
    // EDITAL 22/2026: "Inscrições deferidas e indeferidas Link de Inscrição Edital 22".
    expect(mapIfmtEdital(byId(36275), "2026-10-29T12:00:00.000Z")!.summary).toBeNull();
  });

  it("reads the deadline from a short numeric period", () => {
    // Edital nº 3/2026 (Sinop): "Inscrições: 28 a 30/09/2026".
    expect(mapIfmtEdital(beforeResults(byId(35347)), "2026-09-28T12:00:00.000Z")!.registrationDeadline).toBe("2026-09-30");
  });

  it("drops calls without students in the audience, and staff or election calls", () => {
    const titles = (ids: number[]) => ids.map((id) => byId(id).title.rendered);
    const dropped = posts.filter((p) => mapIfmtEdital(p, "2026-09-01T12:00:00.000Z") === null).map((p) => p.title.rendered);
    expect(dropped.some((t) => /SELEÇÃO DE DOCENTES/.test(t))).toBe(true);
    expect(dropped.some((t) => /Eleição para o Conselho Superior/.test(t))).toBe(true);
    expect(dropped.some((t) => /Pilotagem de Drones/.test(t))).toBe(true);
    expect(dropped).not.toContain(titles([BOLSISTAS_39])[0]);
  });
});

describe("collectIfmt", () => {
  it("reads pages until the posts are older than 60 days", async () => {
    const urls: string[] = [];
    const result = await collectIfmt({
      verifiedAt: "2026-10-29T12:00:00.000Z",
      fetchJson: async (url) => {
        urls.push(url);
        return page;
      },
    });
    // The fixture has 50 posts (fewer than a full page of 100): one request is enough.
    expect(urls).toEqual(["https://ifmt.edu.br/wp-json/wp/v2/edital?per_page=100&page=1&_fields=id,date,link,title,content,class_list"]);
    expect(result.opportunities.length).toBeGreaterThan(5);
    expect(result.opportunities.every((o) => o.eligibility.institutions?.[0] === "IFMT")).toBe(true);
    expect(result.opportunities.length + result.skipped).toBe(posts.length);
  });
});

describe("mapIfmtEdital summary", () => {
  it("skips the formal opening (\"O DIRETOR-GERAL … no uso de suas atribuições\")", () => {
    const campoVerde = posts.find((p) => /vagas remanescentes\) para projeto de extens/.test(p.title.rendered))!;
    expect(mapIfmtEdital(campoVerde, "2026-10-29T12:00:00.000Z")!.summary ?? "").not.toMatch(/DIRETOR-GERAL/);
  });
});

describe("collectIfmt without a deadline", () => {
  it("keeps a call with no deadline in the text for 30 days only", async () => {
    const result = await collectIfmt({ verifiedAt: "2026-10-29T12:00:00.000Z", fetchJson: async () => page });
    const undated = result.opportunities.filter((o) => !o.registrationDeadline);
    expect(undated.length).toBeGreaterThan(0);
    const published = new Map(posts.map((p) => [String(p.id), p.date.slice(0, 10)]));
    expect(undated.every((o) => published.get(o.sourceId)! >= "2026-09-29")).toBe(true);
  });
});
