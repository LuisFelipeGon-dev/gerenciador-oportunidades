import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { firstSentence, parseInscriptionPeriod, parseStipend, parseSummary } from "./edital-text";

/** Text of UFMT's Edital 016/2026 (PROEG, PET Conexões de Saberes), as unpdf extracts it. */
const edital016 = readFileSync(new URL("./__fixtures__/ufmt-edital-016-2026.txt", import.meta.url), "utf8");

describe("parseInscriptionPeriod", () => {
  it.each([
    ["Inscrição: Período de 30/10 a 30/11/2026 Vagas: conforme o edital", { start: "2026-10-30", end: "2026-11-30" }],
    ["Inscrições: 28 a 30/09/2026 Vagas: 6 bolsas", { start: "2026-09-28", end: "2026-09-30" }],
    ["Período de inscrições: 13/10/2026 a 08/11/2026", { start: "2026-10-13", end: "2026-11-08" }],
    ["Inscrições de 15/12 a 10/01/2027", { start: "2026-12-15", end: "2027-01-10" }],
  ])("reads short numeric periods: %s", (text, period) => {
    expect(parseInscriptionPeriod(text)).toEqual(period);
  });

  it("reads the period of the real Edital 016", () => {
    expect(parseInscriptionPeriod(edital016)).toEqual({ start: "2026-10-27", end: "2026-11-03" });
  });

  it("reads written-out dates across a line break", () => {
    expect(parseInscriptionPeriod("Período de inscrição\nDe 27 de outubro a 03 de novembro de 2026.")).toEqual({
      start: "2026-10-27",
      end: "2026-11-03",
    });
  });

  it("reads a period with the month only at the end (Edital 015/2026)", () => {
    expect(parseInscriptionPeriod("Período de inscrição De 13 a 24 de outubro de 2026. Resultado preliminar")).toEqual({
      start: "2026-10-13",
      end: "2026-10-24",
    });
  });

  it("reads \"à\" as the end of the period (Edital 014/2026)", () => {
    expect(parseInscriptionPeriod("Período de Inscrições De 12 de outubro à 16 de outubro de 2026 Divulgação")).toEqual({
      start: "2026-10-12",
      end: "2026-10-16",
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

  it("allows words between \"Edital\" and \"para\" (Edital 014/2026)", () => {
    expect(
      parseSummary(
        "torna público o presente Edital de Abertura de Inscrição para o Processo de Seleção de estudantes bolsistas para o Programa de Educação Tutorial (PET) MEDICINA, considerando o disposto na Lei",
      ),
    ).toBe("Processo de Seleção de estudantes bolsistas para o Programa de Educação Tutorial (PET) MEDICINA");
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

  it("reads the value of the real Edital 016, split across lines", () => {
    expect(parseStipend(edital016)).toBe("R$ 700,00");
  });

  it("returns null when there is no value", () => {
    expect(parseStipend("Bolsa conforme regras do programa, sem valor informado.")).toBeNull();
  });
});

describe("firstSentence", () => {
  it("stops at the end of the first sentence, not at abbreviations like Nº.", () => {
    expect(firstSentence("Seleção de bolsistas do Edital Nº. 22/2026 para o câmpus. Inscrições pelo SUAP.")).toBe(
      "Seleção de bolsistas do Edital Nº. 22/2026 para o câmpus.",
    );
  });

  it("does not stop at titles like Prof. and Cel.", () => {
    expect(firstSentence("Seleção do IFMT – Campus Cáceres – Prof. Olegário Baldo e Cel. Octayde. Inscrições pelo SUAP.")).toBe(
      "Seleção do IFMT – Campus Cáceres – Prof. Olegário Baldo e Cel. Octayde.",
    );
  });

  it("cuts long sentences at a word, with an ellipsis", () => {
    const long = `Este processo seletivo ${"tem como objetivo selecionar estudantes ".repeat(10)}fim.`;
    const s = firstSentence(long)!;
    expect(s.length).toBeLessThanOrEqual(240);
    expect(s.endsWith("…")).toBe(true);
  });

  it("is null for empty text", () => {
    expect(firstSentence("  ")).toBeNull();
  });
});
