"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";
import { AREA_IDS } from "./areas";
import { STATES } from "./brazil";
import { OPPORTUNITY_TYPES } from "./opportunity";
import { DEFAULT_RADIUS_KM, LEVELS, type Profile } from "./personalize";

// Per-visitor data kept in this browser. With an account it mirrors the database (see account.ts).
// Every read is defensive: storage can be blocked (private mode) or hold an older version.

export const PROFILE_KEY = "oportunidades:perfil:v2";
export const SAVED_KEY = "oportunidades:salvos:v1";

export const profileSchema = z.object({
  name: z.string().max(60).default(""),
  course: z.string().min(1).max(80),
  area: z.enum(AREA_IDS),
  city: z.string().min(1).max(80),
  state: z.enum(STATES.map((s) => s.uf) as [string, ...string[]]),
  level: z.enum(LEVELS),
  birthDate: z.iso.date(),
  interests: z.array(z.enum(OPPORTUNITY_TYPES)),
  // Profiles saved before the radius existed get the default.
  radiusKm: z.number().int().min(1).max(5000).default(DEFAULT_RADIUS_KM),
  // Required in the form; profiles saved before they existed are read with both empty.
  institution: z.string().max(80).default(""),
  campus: z.string().max(80).default(""),
});

const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function read<T>(key: string, parse: (raw: string) => T, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return (cache.get(key)?.value as T | undefined) ?? fallback;
  }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value = fallback;
  if (raw !== null) {
    try {
      value = parse(raw);
    } catch {
      value = fallback;
    }
  }
  cache.set(key, { raw, value });
  return value;
}

export function writeLocal(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: the change lives only until the page reloads.
    cache.set(key, { raw: null, value });
  }
  notify();
}

export function notify() {
  listeners.forEach((l) => l());
}

export function subscribeLocal(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === PROFILE_KEY || e.key === SAVED_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const EMPTY: string[] = [];
export const readProfile = () => read(PROFILE_KEY, (raw) => profileSchema.parse(JSON.parse(raw)) as Profile, null);
export const readSaved = () => read(SAVED_KEY, (raw) => z.array(z.string()).parse(JSON.parse(raw)), EMPTY);

/** undefined while rendering on the server, before the browser storage can be read. */
export function useProfile(): Profile | null | undefined {
  return useSyncExternalStore(subscribeLocal, readProfile, () => undefined);
}

export function useSaved(): string[] {
  return useSyncExternalStore(subscribeLocal, readSaved, () => EMPTY);
}
