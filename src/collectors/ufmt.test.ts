import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cleanTitle, collectUfmt, isStudentCall, mapUfmtPublication, parsePublicationsPage, type UfmtPublication } from "./ufmt";

const fixture = (name: string) => readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url));
const proegPage = JSON.parse(fixture("ufmt-publications-proeg.json").toString("utf8"));
const edital016Text = readFileSync(new URL("../lib/__fixtures__/ufmt-edital-016-2026.txt", import.meta.url), "utf8");
const VERIFIED_AT = "2026-10-28T12:00:00.000Z";
const PROEG = { id: 17, acronym: "PROEG" };

const publications = parsePublicationsPage(proegPage);
const byId = (id: number) => publications.find((p) => p.id === id)!;

describe("isStudentCall", () => {
  it.each([
    "Edital 016/2026 - PROEG/CFD/GPE - Seleção de Bolsistas PET Conexões de Saberes",
    "EDITAL 014/2026 PROEG/CFD/GPE SELEÇÃO DE ALUNOS BOLSISTAS - PET MEDICINA",
    "Edital de Monitoria 2026/2",
    "Edital PRAE - Bolsa Permanência 2026",
    "Edital PIBIC 2026/2027",
    "PROGRAMA BOLSA PERMANÊNCIA DO MINISTÉRIO DA EDUCAÇÃO - MEC",
    "EDITAL PROCEV/UFMT Nº 14/2026 - EDITAL DE APOIO AO ESPORTE UNIVERSITÁRIO",
  ])("keeps: %s", (title) => {
    expect(isStudentCall(title)).toBe(true);
  });

  it.each([
    "EDITAL Nº 12/2026 - PROEG - PROCESSO SELETIVO PARA ESCOLHA DE DOCENTES/TUTORAS(ES)",
    "Edital008/2026 PROEG/CFD/GPE - Seleção para tutor PET Indígena",
    "EDITAL DE SELEÇÃO SIMPLIFICADO DE FACILITADORES(AS) DE AÇÕES DE DESENVOLVIMENTO",
    "EDITAL Nº 24/2026 PROEG/UFMT - REGULARIZAÇÃO DE VÍNCULO ACADÊMICO",
    "Resultado final do Edital 014/2026 - Seleção de alunos bolsistas",
    "Retificação do Edital 015/2026 - Seleção de bolsistas",
    "EDITAL Nº 15/PROCEV/UFMT - 2026 PROGRAMA DE APOIO À EXTENSÃO – PROEX UFMT – 2026",
    "CHAMADA INTERNA CONJUNTA EIT/PROPESQ/PROPG - 01/2026 - CHAMADA INTERNA PARA COMPOSIÇÃO DA PROPOSTA INSTITUCIONAL",
    "EDITAL PROPESQ Nº 16/2026 APOIO À PARTICIPAÇÃO DE PESQUISADORES(AS) EM EVENTOS CIENTÍFICOS",
  ])("drops: %s", (title) => {
    expect(isStudentCall(title)).toBe(false);
  });
});

describe("cleanTitle", () => {
  it.each([
    [
      "Edital 016/2026 - PROEG/CFD/GPE - Seleção de Bolsistas PET Conexões de Saberes: Inclusão Diversidade e Protagonismo",
      "Edital 016/2026 - Seleção de Bolsistas PET Conexões de Saberes: Inclusão Diversidade e Protagonismo",
    ],
    ["EDITAL 015/2026 PROEG/CFD/GPE Seleção Alunos Bolsistas e Voluntários PET Ed. Física", "EDITAL 015/2026 - Seleção Alunos Bolsistas e Voluntários PET Ed. Física"],
    ["EDITAL 009-2026 PROEG-CFD-GPE Sel. Bolsistas e Voluntários PET ED. Física", "EDITAL 009-2026 - Sel. Bolsistas e Voluntários PET ED. Física"],
    ["EDITAL PROCEV/UFMT Nº 14/2026 - EDITAL DE APOIO AO ESPORTE UNIVERSITÁRIO", "EDITAL Nº 14/2026 - EDITAL DE APOIO AO ESPORTE UNIVERSITÁRIO"],
  ])("%s", (title, clean) => {
    expect(cleanTitle(title)).toBe(clean);
  });
});

describe("mapUfmtPublication", () => {
  it("maps Edital 016 with what the PDF says", () => {
    expect(mapUfmtPublication(byId(6899), PROEG, edital016Text, VERIFIED_AT)).toMatchObject({
      type: "scholarship",
      title: "Edital 016/2026 - Seleção de Bolsistas PET Conexões de Saberes: Inclusão Diversidade e Protagonismo",
      organizer: "UFMT · PROEG",
      officialUrl: byId(6899).files[0].filename,
      modality: "in_person",
      location: { city: "Cuiabá", state: "MT", country: "BR" },
      startsOn: null,
      registrationDeadline: "2026-11-03",
      eligibility: { institutions: ["UFMT"], campuses: ["Cuiabá"], levels: ["undergraduate"], studentsOnly: true },
      benefits: ["Bolsa de R$ 700,00"],
      tags: ["Edital UFMT", "PET"],
      source: "ufmt",
      sourceId: "6899",
      status: "open",
    });
    const o = mapUfmtPublication(byId(6899), PROEG, edital016Text, VERIFIED_AT)!;
    expect(o.summary?.startsWith("Processo de Seleção de Estudantes bolsistas")).toBe(true);
    expect(o.note).toBe("Lido automaticamente do edital: confira datas e requisitos no PDF.");
  });

  it("keeps the item without the PDF fields when the text is missing", () => {
    const o = mapUfmtPublication(byId(6879), PROEG, null, VERIFIED_AT)!;
    expect(o).toMatchObject({ registrationDeadline: null, startsOn: null, summary: null, benefits: [] });
    expect(o.note).toBe("Prazo e requisitos: veja no edital. Lido automaticamente: confira no PDF.");
    // No campus in the title: any UFMT student.
    expect(o.eligibility.campuses).toBeNull();
  });

  it("drops calls whose inscription already closed", () => {
    expect(mapUfmtPublication(byId(6899), PROEG, edital016Text, "2026-11-10T12:00:00.000Z")).toBeNull();
  });
});

describe("collectUfmt", () => {
  const pdf = new Uint8Array(fixture("ufmt-edital-016-2026.pdf"));

  it("collects recent student calls of each unit and survives a PDF that fails", async () => {
    const requested: string[] = [];
    let pdfCalls = 0;
    const result = await collectUfmt({
      verifiedAt: VERIFIED_AT,
      fetchJson: async (url) => {
        requested.push(url);
        return url.includes("branch=17") ? proegPage : { data: [] };
      },
      fetchBytes: async () => pdf,
      // The second PDF cannot be read.
      pdfToText: async () => {
        pdfCalls++;
        if (pdfCalls === 2) throw new Error("bad pdf");
        return edital016Text;
      },
    });
    // Last 60 days and for students: 6899 (016), 6879 (015), 6854 (014). 6885 is a regularização.
    expect(result.opportunities.map((o) => o.sourceId).sort()).toEqual(["6854", "6879", "6899"]);
    expect(result.opportunities.filter((o) => o.registrationDeadline === null)).toHaveLength(1);
    expect(requested.map((u) => new URL(u).searchParams.get("branch")).sort()).toEqual(["10", "11", "13", "17"]);
  });

  it("fails when the API answers in an unexpected shape", async () => {
    await expect(collectUfmt({ verifiedAt: VERIFIED_AT, fetchJson: async () => ({ nope: true }), fetchBytes: async () => pdf })).rejects.toThrow();
  });
});

// Type check that the fixture parses into the exported shape.
const _shape: UfmtPublication = byId(6899);
void _shape;
