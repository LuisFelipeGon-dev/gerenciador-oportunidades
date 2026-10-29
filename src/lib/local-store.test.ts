import { describe, expect, it } from "vitest";
import { profileSchema } from "./local-store";

describe("profileSchema", () => {
  it("still reads profiles saved before universidade e câmpus, with both empty", () => {
    const saved = {
      name: "",
      course: "Ciência da Computação",
      area: "tech",
      city: "Cuiabá",
      state: "MT",
      level: "undergraduate",
      birthDate: "2004-03-10",
      interests: [],
      radiusKm: 100,
    };
    expect(profileSchema.parse(saved)).toMatchObject({ institution: "", campus: "" });
  });
});
