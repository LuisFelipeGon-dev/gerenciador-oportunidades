import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  collectUnemat,
  isFromPastYears,
  isUnematStudentCall,
  mainDocumentUrl,
  mapUnematEdital,
  parseSearchResults,
  type UnematItem,
} from "./unemat";

const fixture = (name: string) => readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");
const integradora = JSON.parse(fixture("unemat-busca-104.json")).editais as string;
const transporte = JSON.parse(fixture("unemat-busca-102.json")).editais as string;
const detail009 = fixture("unemat-edital-009-2026.html");
const edital009Text = readFileSync(new URL("../lib/__fixtures__/unemat-edital-009-2026.txt", import.meta.url), "utf8");
const PDF_009 = "https://cms.unemat.br/storage/documentos/documento-arquivo/YCoBkke3hpr7yXN9NOdplv01LfThhZzjd9qVX8sf.pdf";
const URL_009 = "https://unemat.br/editais/9-10-2026-edital-009-2026-bolsa-integradora";

describe("parseSearchResults", () => {
  it("reads title, link, category and the publication date, with the year of the link", () => {
    const items = parseSearchResults(integradora, "2026-10-29");
    expect(items.map((i) => i.publishedOn)).toEqual(["2026-10-09", "2026-06-02", "2025-10-02", "2025-06-10"]);
    expect(items[0]).toEqual({
      url: URL_009,
      title: "Edital 009/2026 - Bolsa Integradora",
      category: "Bolsa Integradora",
      publishedOn: "2026-10-09",
    });
  });

  it("takes the latest year that is not in the future when the link has no date", () => {
    const [first] = parseSearchResults(transporte, "2026-10-29");
    expect(first.publishedOn).toBe("2026-07-23");
    expect(first.title).toBe(
      "EDITAL Nº 008/2026 - UNEMAT/PRAE SELEÇÃO PARA CONCESSÃO DE AUXÍLIO TRANSPORTE NO CAMPUS UNIVERSITÁRIO DE PONTES E LACERDA NO ANO LETIVO DE 2026",
    );
    expect(parseSearchResults(transporte, "2026-05-01")[0].publishedOn).toBe("2025-07-23");
  });

  it("returns nothing for an empty search", () => {
    expect(parseSearchResults("", "2026-10-29")).toEqual([]);
  });
});

describe("mainDocumentUrl", () => {
  it("picks the edital itself, not the complementary ones published after it", () => {
    expect(mainDocumentUrl(detail009)).toBe(PDF_009);
  });

  it("is null when the page lists no document", () => {
    expect(mainDocumentUrl("<div>EDITAIS/ANEXO(S)</div>")).toBeNull();
  });
});

describe("isUnematStudentCall", () => {
  it.each([
    ["EDITAL Nº 002/2026 - UNEMAT/PROEG/APE/AFIRMASUS - DISCENTE", true],
    ["Edital 009/2026 - Bolsa Integradora", true],
    ["EDITAL Nº 001/2026 - UNEMAT/PROEG/APE/AFIRMASUS - TUTOR", false],
    ["Resultado final do Edital 009/2026", false],
    ["Edital Complementar Nº 02 ao Edital 009/2026", false],
    ["Seleção de professor orientador - Bolsa Extensão", false],
  ])("%s -> %s", (title, ok) => {
    expect(isUnematStudentCall(title)).toBe(ok);
  });
});

const item009: UnematItem = { url: URL_009, title: "Edital 009/2026 - Bolsa Integradora", category: "Bolsa Integradora", publishedOn: "2026-10-09" };

describe("isFromPastYears", () => {
  it.each([
    ["EDITAL 005_2021 PROEC - Bolsa Iniciação em Extensão Universitária", "2026-10-02", true],
    ["EDITAL Nº 001/2023 - UNEMAT/PROEG/APE – FOCCO", "2026-09-10", true],
    ["Edital 009/2026 - Bolsa Integradora", "2026-10-09", false],
    ["Edital 012/2025 - Bolsa Integradora", "2025-12-20", false],
    ["Edital Processo Seletivo para Concessão de Auxílios Alimentação e Moradia - 2026/2", "2026-07-10", false],
    ["BOLSA FORMAÇÃO", "2026-06-01", false],
  ])("%s (%s) -> %s", (title, publishedOn, old) => {
    expect(isFromPastYears(title, publishedOn)).toBe(old);
  });
});

describe("mapUnematEdital", () => {
  it("maps Edital 009 with what the PDF says, while inscriptions are open", () => {
    const o = mapUnematEdital(item009, "scholarship", edital009Text, "2026-10-12T12:00:00.000Z")!;
    expect(o).toMatchObject({
      type: "scholarship",
      title: "Edital 009/2026 - Bolsa Integradora",
      organizer: "UNEMAT · PRAE",
      officialUrl: URL_009,
      modality: "in_person",
      location: { city: "Cáceres", state: "MT", country: "BR" },
      startsOn: null,
      registrationDeadline: "2026-10-23",
      eligibility: { institutions: ["UNEMAT"], campuses: null, levels: ["undergraduate"], studentsOnly: true },
      benefits: ["Bolsa de R$ 700,00"],
      tags: ["Edital UNEMAT", "Bolsa Integradora"],
      source: "unemat",
      sourceId: "9-10-2026-edital-009-2026-bolsa-integradora",
    });
    expect(o.note).toBe("Lido automaticamente do edital: confira datas e requisitos no PDF.");
  });

  it("drops it once the inscription period is over", () => {
    expect(mapUnematEdital(item009, "scholarship", edital009Text, "2026-10-29T12:00:00.000Z")).toBeNull();
  });

  it("takes the campus from the title and its city", () => {
    const [p] = parseSearchResults(transporte, "2026-10-29");
    const o = mapUnematEdital(p, "scholarship", null, "2026-07-24T12:00:00.000Z")!;
    expect(o.eligibility.campuses).toEqual(["Pontes e Lacerda"]);
    expect(o.location.city).toBe("Pontes e Lacerda");
    expect(o.registrationDeadline).toBeNull();
    expect(o.note).toBe("Prazo e requisitos: veja no edital. Lido automaticamente: confira no PDF.");
  });

  it("maps internships as internships", () => {
    expect(mapUnematEdital(item009, "internship", null, "2026-10-12T12:00:00.000Z")!.type).toBe("internship");
  });
});

describe("collectUnemat", () => {
  it("searches each student type, keeps recent calls and reads their PDF", async () => {
    const searched: string[] = [];
    const result = await collectUnemat({
      verifiedAt: "2026-10-12T12:00:00.000Z",
      types: { "104": "scholarship", "102": "scholarship" },
      search: async (type) => {
        searched.push(type);
        return type === "104" ? integradora : transporte;
      },
      fetchText: async (url) => {
        expect(url).toBe(URL_009);
        return detail009;
      },
      fetchBytes: async (url) => {
        expect(url).toBe(PDF_009);
        return new Uint8Array([1]);
      },
      pdfToText: async () => edital009Text,
    });
    expect(searched.sort()).toEqual(["102", "104"]);
    // Only 009/2026 is from the last 60 days.
    expect(result.opportunities.map((o) => o.sourceId)).toEqual(["9-10-2026-edital-009-2026-bolsa-integradora"]);
    expect(result.opportunities[0].registrationDeadline).toBe("2026-10-23");
    expect(result.skipped).toBe(5);
  });

  it("drops a call whose page already lists the final result", async () => {
    const withFinal = detail009.replace(
      "Resultado Preliminar dos Recursos da 1ª Etapa",
      "Resultado Final",
    );
    const result = await collectUnemat({
      verifiedAt: "2026-10-12T12:00:00.000Z",
      types: { "104": "scholarship" },
      search: async () => integradora,
      fetchText: async () => withFinal,
      fetchBytes: async () => new Uint8Array([1]),
      pdfToText: async () => edital009Text,
    });
    expect(result.opportunities).toEqual([]);
  });

  it("keeps the call without PDF fields when the PDF cannot be read", async () => {
    const result = await collectUnemat({
      verifiedAt: "2026-10-12T12:00:00.000Z",
      types: { "104": "scholarship" },
      search: async () => integradora,
      fetchText: async () => detail009,
      fetchBytes: async () => {
        throw new Error("404");
      },
    });
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0].registrationDeadline).toBeNull();
  });
});
