import { describe, expect, it } from "vitest";
import type { Profile } from "./personalize";
import { profileFromRow, profileToRow, type ProfileRow } from "./profile-row";

const row: ProfileRow = {
  id: "user-1",
  name: "Ana",
  course: "Ciência da Computação",
  area: "tech",
  city: "Cuiabá",
  state: "MT",
  study_level: "undergraduate",
  birth_date: "2004-03-10",
  interests: ["hackathon"],
  radius_km: 200,
  consented_at: "2026-10-27T12:00:00Z",
  privacy_version: "2026-10-27",
  alerts_enabled: true,
  alerts_enabled_at: "2026-10-28T12:00:00Z",
  alerts_token: "6f1c0b8e-0000-4000-8000-000000000001",
  alerts_last_sent_at: null,
  institution: "UFMT",
  campus: "Cuiabá",
};

describe("profileFromRow", () => {
  it("maps a complete row, with the radius", () => {
    expect(profileFromRow(row)).toEqual({
      name: "Ana",
      course: "Ciência da Computação",
      area: "tech",
      city: "Cuiabá",
      state: "MT",
      level: "undergraduate",
      birthDate: "2004-03-10",
      interests: ["hackathon"],
      radiusKm: 200,
      institution: "UFMT",
      campus: "Cuiabá",
    });
  });

  it("uses the default radius when the row has none", () => {
    expect(profileFromRow({ ...row, radius_km: null })?.radiusKm).toBe(100);
  });

  it("returns null for an incomplete profile", () => {
    expect(profileFromRow({ ...row, course: null })).toBeNull();
  });
});

describe("profileToRow", () => {
  it("round-trips through profileFromRow", () => {
    const profile = profileFromRow(row) as Profile;
    expect(profileFromRow({ ...row, ...profileToRow("user-1", profile) })).toEqual(profile);
  });
});

describe("profiles saved before universidade e câmpus", () => {
  it("are read with both empty", () => {
    expect(profileFromRow({ ...row, institution: null, campus: null })).toMatchObject({ institution: "", campus: "" });
  });
});
