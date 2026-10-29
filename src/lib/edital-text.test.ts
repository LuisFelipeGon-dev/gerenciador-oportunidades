import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { campusFromTitle, parseInscriptionPeriod, parseStipend, parseSummary } from "./edital-text";

/** Text of UFMT's Edital 016/2026 (PROEG, PET Conexões de Saberes), as unpdf extracts it. */
const edital016 = readFileSync(new URL("./__fixtures__/ufmt-edital-016-2026.txt", import.meta.url), "utf8");

describe("parseInscriptionPeriod", () => {
  it("reads the period of the real Edital 016", () => {
    expect(parseInscriptionPeriod(edital016)).toEqual({ start: "2026-10-27", end: "2026-11-03" });
  });

  it("reads written-out dates across a line break", () => {
    expect(parseInscriptionPeriod("Período de inscrição\nDe 27 de outubro a 03 de novembro de 2026.")).toEqual({
      start: "2026-10-27",
      end: "2026-11-03",
    });
  });

  it("reads numeric dates", () => {
    expect(parseInscriptionPeriod("Inscrições: 27/10/2026 a 03/11/2026")).toEqual({ start: "2026-10-27", end: "2026-11-03" });
  });

  it("gives the start the previous year when the period crosses the new year", () => {
    expect(parseInscriptionPeriod("inscrições de 15 de dezembro a 10 de janeiro de 2027")).toEqual({
      start: "2026-12-15",
      end: "2027-01-10",
    });
  });

  it("reads a deadline with no start", () => {
    expect(parseInscriptionPeriod("As inscrições vão até 03 de novembro de 2026.")).toEqual({ start: null, end: "2026-11-03" });
  });

  it("ignores dates that are not about the inscription", () => {
    expect(parseInscriptionPeriod("Resultado final: 09 de novembro de 2026.")).toBeNull();
    expect(
      parseInscriptionPeriod(
        `Inscrições pelo e-mail do grupo, com os documentos listados no item 4, que devem estar legíveis, completos e assinados quando for o caso, sem rasuras, e enviados em PDF dentro do prazo indicado no cronograma. ${"Texto. ".repeat(40)} Resultado: 09 de novembro de 2026.`,
      ),
    ).toBeNull();
  });
});

describe("parseSummary", () => {
  it("takes what the edital is for, from the real Edital 016", () => {
    const summary = parseSummary(edital016)!;
    expect(summary.startsWith("Processo de Seleção de Estudantes bolsistas e voluntários para o GRUPO PET")).toBe(true);
    expect(summary).not.toContain("\n");
    expect(summary.length).toBeLessThanOrEqual(240);
  });

  it("cuts long summaries with an ellipsis", () => {
    const summary = parseSummary(`torna público o presente Edital para ${"a seleção de estudantes ".repeat(20)}.`)!;
    expect(summary.length).toBeLessThanOrEqual(240);
    expect(summary.endsWith("…")).toBe(true);
  });

  it("returns null without the usual opening", () => {
    expect(parseSummary("Texto qualquer sem a frase de abertura.")).toBeNull();
  });
});

describe("parseStipend", () => {
  it("reads the stipend value", () => {
    expect(parseStipend("bolsa mensal no valor de R$ 700,00 (setecentos reais)")).toBe("R$ 700,00");
    expect(parseStipend("Auxílio de R$1.200,00 por mês")).toBe("R$ 1.200,00");
  });

  it("returns null when there is no value", () => {
    expect(parseStipend(edital016)).toBeNull();
  });
});

describe("campusFromTitle", () => {
  it.each([
    ["EDITAL 016/2026 SELEÇÃO DE ALUNOS - CAMPUS CUIABÁ", "Cuiabá"],
    ["Edital de monitoria - Câmpus Universitário do Araguaia", "Araguaia"],
    ["Seleção PET - Campus Sinop", "Sinop"],
    ["Edital Câmpus Várzea Grande", "Várzea Grande"],
    ["Edital 013/2026 - Seleção PET Indígena", null],
  ])("%s -> %s", (title, campus) => {
    expect(campusFromTitle(title)).toBe(campus);
  });
});
