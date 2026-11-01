import { describe, expect, it } from "vitest";
import { formatBrDate, maskDate, parseBrDate, suggest } from "./suggest";

describe("suggest", () => {
  const courses = ["Ciência da Computação", "Engenharia de Computação", "Computação Gráfica", "Direito", "Medicina"];

  it("puts options that start with the query first, then word starts, then the rest", () => {
    expect(suggest(courses, "comp")).toEqual(["Computação Gráfica", "Ciência da Computação", "Engenharia de Computação"]);
    expect(suggest(["Biomedicina", "Medicina"], "edic")).toEqual(["Biomedicina", "Medicina"]);
  });

  it("ignores accents and case", () => {
    expect(suggest(["Cuiabá", "Várzea Grande"], "CUIABA")).toEqual(["Cuiabá"]);
    expect(suggest(["Cuiabá"], "cuiabá")).toEqual(["Cuiabá"]);
  });

  it("lists the first options when nothing was typed, up to the limit", () => {
    expect(suggest(courses, "  ", 2)).toEqual(["Ciência da Computação", "Engenharia de Computação"]);
    expect(suggest(courses, "a", 1)).toHaveLength(1);
  });

  it("returns nothing when no option matches", () => {
    expect(suggest(courses, "xyz")).toEqual([]);
  });
});

describe("maskDate", () => {
  it("adds slashes as the person types and drops anything that is not a digit", () => {
    expect(maskDate("1")).toBe("1");
    expect(maskDate("150")).toBe("15/0");
    expect(maskDate("15032005")).toBe("15/03/2005");
    expect(maskDate("15-03-2005 extra 99")).toBe("15/03/2005");
  });
});

describe("parseBrDate", () => {
  it("turns a complete date into ISO", () => {
    expect(parseBrDate("15/03/2005")).toBe("2005-03-15");
    expect(parseBrDate("29/02/2004")).toBe("2004-02-29");
  });

  it("rejects incomplete dates and days that do not exist", () => {
    expect(parseBrDate("15/03/20")).toBeNull();
    expect(parseBrDate("31/02/2005")).toBeNull();
    expect(parseBrDate("29/02/2005")).toBeNull();
    expect(parseBrDate("00/13/2005")).toBeNull();
  });
});

describe("formatBrDate", () => {
  it("shows an ISO date as day/month/year", () => {
    expect(formatBrDate("2005-03-15")).toBe("15/03/2005");
    expect(formatBrDate(undefined)).toBe("");
  });
});
