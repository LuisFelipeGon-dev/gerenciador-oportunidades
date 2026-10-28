import { describe, expect, it } from "vitest";
import { areaById, areaForCourse } from "./areas";

describe("areaForCourse", () => {
  it.each([
    ["Ciência da Computação", "tech"],
    ["Engenharia de Software", "tech"],
    ["Engenharia de Computação", "tech"],
    ["Análise e Desenvolvimento de Sistemas", "tech"],
    ["Engenharia Civil", "engineering"],
    ["Jornalismo", "communication"],
    ["Publicidade e Propaganda", "communication"],
    ["Medicina", "health"],
    ["Medicina Veterinária", "health"],
    ["Direito", "law"],
    ["Agronomia", "agrarian"],
    ["Relações Internacionais", "humanities"],
    ["Arquitetura e Urbanismo", "design"],
    ["Curso inventado", "other"],
  ])("%s -> %s", (course, area) => {
    expect(areaForCourse(course)).toBe(area);
  });
});

describe("areaById", () => {
  it("does not offer hackathons by default to communication courses", () => {
    expect(areaById("communication").defaultTypes).not.toContain("hackathon");
  });

  it("falls back to other for unknown ids", () => {
    expect(areaById("xyz").id).toBe("other");
  });
});
