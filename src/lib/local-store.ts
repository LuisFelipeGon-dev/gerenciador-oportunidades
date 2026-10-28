"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";
import { STATES } from "./brazil";
import { OPPORTUNITY_TYPES } from "./opportunity";
import { LEVELS, type Profile } from "./personalize";

// Per-visitor data kept in this browser until login exists. Every read is defensive:
// storage can be blocked (private mode) or hold a value from an older version.

const PROFILE_KEY = "oportunidades:perfil:v1";
const SAVED_KEY = "oportunidades:salvos:v1";

const profileSchema = z.object({
  name: z.string().max(60).default(""),
  course: z.string().max(80),
  city: z.string().max(80),
  state: z.enum(STATES.map((s) => s.uf) as [string, ...string[]]),
  level: z.enum(LEVELS),
  adult: z.boolean(),
  interests: z.array(z.enum(OPPORTUNITY_TYPES)),
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

function write(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: the change lives only until the page reloads.
    cache.set(key, { raw: null, value });
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
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
const readProfile = () => read(PROFILE_KEY, (raw) => profileSchema.parse(JSON.parse(raw)) as Profile, null);
const readSaved = () => read(SAVED_KEY, (raw) => z.array(z.string()).parse(JSON.parse(raw)), EMPTY);

/** undefined while rendering on the server, before the browser storage can be read. */
export function useProfile(): Profile | null | undefined {
  return useSyncExternalStore(subscribe, readProfile, () => undefined);
}

export function saveProfile(profile: Profile | null) {
  write(PROFILE_KEY, profile);
}

export function useSaved(): string[] {
  return useSyncExternalStore(subscribe, readSaved, () => EMPTY);
}

export function toggleSaved(key: string) {
  const current = readSaved();
  write(SAVED_KEY, current.includes(key) ? current.filter((k) => k !== key) : [...current, key]);
}

/** False on the server and during hydration, true afterwards. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
