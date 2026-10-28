import { profileSchema } from "./local-store";
import type { Profile } from "./personalize";

// The profiles table (migrations 0001, 0004, 0007) and its mapping to Profile. Shared by the
// account sync in the browser and by the weekly alerts script.

export type ProfileRow = {
  id: string;
  name: string | null;
  course: string | null;
  area: string | null;
  city: string | null;
  state: string | null;
  study_level: string | null;
  birth_date: string | null;
  interests: string[] | null;
  radius_km: number | null;
  consented_at: string | null;
  privacy_version: string | null;
  alerts_enabled: boolean;
  alerts_enabled_at: string | null;
  alerts_token: string;
  alerts_last_sent_at: string | null;
};

export function profileToRow(userId: string, p: Profile) {
  return {
    id: userId,
    name: p.name,
    course: p.course,
    area: p.area,
    city: p.city,
    state: p.state,
    study_level: p.level,
    birth_date: p.birthDate,
    interests: p.interests,
    radius_km: p.radiusKm,
  };
}

/** The profile in a row, or null when it is incomplete (e.g. an account that never filled it). */
export function profileFromRow(row: ProfileRow): Profile | null {
  const parsed = profileSchema.safeParse({
    name: row.name ?? "",
    course: row.course,
    area: row.area,
    city: row.city,
    state: row.state,
    level: row.study_level,
    birthDate: row.birth_date,
    interests: row.interests ?? [],
    radiusKm: row.radius_km ?? undefined,
  });
  return parsed.success ? (parsed.data as Profile) : null;
}
