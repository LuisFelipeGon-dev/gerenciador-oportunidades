import { describe, expect, it } from "vitest";
import { campusCity, campusFromText, campusNames, withArticle } from "./institutions";

describe("campusFromText", () => {
  it.each([
    ["UFMT", "EDITAL 016/2026 SELEÇÃO DE ALUNOS - CAMPUS CUIABÁ", "Cuiabá"],
    ["UFMT", "Edital de monitoria - Câmpus Universitário do Araguaia", "Araguaia"],
    ["UFMT", "Seleção PET - Campus Sinop", "Sinop"],
    ["UFMT", "Edital Câmpus Várzea Grande", "Várzea Grande"],
    ["UFMT", "Edital 013/2026 - Seleção PET Indígena", null],
    ["UNEMAT", "AUXÍLIO TRANSPORTE NO CAMPUS UNIVERSITÁRIO DE PONTES E LACERDA NO ANO LETIVO DE 2026", "Pontes e Lacerda"],
    ["UNEMAT", "EDITAL Nº 010/2026 – CAMPUS UNIVERSITÁRIO “EUGÊNIO CARLOS STIELER” DE TANGARÁ DA SERRA", "Tangará da Serra"],
    ["UNEMAT", "Câmpus do Médio Araguaia", "Médio Araguaia"],
    ["UNEMAT", "Edital 009/2026 - Bolsa Integradora", null],
    ["IFMT", "Edital Nº 39/2026 – IFMT Campus Cáceres – Prof. Olegário Baldo", "Cáceres"],
    ["IFMT", "IFMT Campus Cuiabá Cel. Octayde Jorge da Silva", "Cuiabá - Octayde"],
  ])("%s: %s -> %s", (inst, text, campus) => {
    expect(campusFromText(inst, text)).toBe(campus);
  });

  it("prefers the longer name when one contains another (Alto Araguaia, not Araguaia)", () => {
    expect(campusFromText("UNEMAT", "Campus de Alto Araguaia")).toBe("Alto Araguaia");
  });

  it("knows nothing of other institutions", () => {
    expect(campusFromText("UNIC", "Campus Cuiabá")).toBeNull();
  });
});

describe("campusCity", () => {
  it.each([
    ["UFMT", "Araguaia", "Barra do Garças"],
    ["UNEMAT", "Médio Araguaia", "Luciara"],
    ["IFMT", "Cuiabá - Bela Vista", "Cuiabá"],
    ["IFMT", "Nowhere", null],
  ])("%s %s -> %s", (inst, campus, city) => {
    expect(campusCity(inst, campus)).toBe(city);
  });
});

describe("campusNames", () => {
  it("lists the campuses of the institution typed, ignoring case", () => {
    expect(campusNames("ufmt")).toEqual(["Cuiabá", "Várzea Grande", "Sinop", "Araguaia"]);
    expect(campusNames("UNEMAT")).toHaveLength(13);
    expect(campusNames("Outra")).toEqual([]);
  });
});

describe("withArticle", () => {
  it.each([
    ["UFMT", "da UFMT"],
    ["IFMT", "do IFMT"],
    ["UNEMAT", "da UNEMAT"],
    ["UFMT, UNEMAT", "da UFMT, UNEMAT"],
  ])("%s -> %s", (inst, text) => {
    expect(withArticle(inst)).toBe(text);
  });
});
