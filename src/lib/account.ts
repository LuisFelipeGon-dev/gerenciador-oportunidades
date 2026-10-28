"use client";

import type { Session } from "@supabase/supabase-js";
import { useEffect, useState, useSyncExternalStore } from "react";
import { PROFILE_KEY, SAVED_KEY, readProfile, readSaved, writeLocal } from "./local-store";
import type { Profile } from "./personalize";
import { profileFromRow as fromRow, profileToRow as toRow, type ProfileRow } from "./profile-row";
import { browserClient } from "./supabase/browser";

export const PRIVACY_VERSION = "2026-10-28";
const PENDING_CONSENT_KEY = "oportunidades:consentimento-pendente";

// ---- session store --------------------------------------------------------------------------

let session: Session | null | undefined;
const listeners = new Set<() => void>();
let started = false;

function start() {
  if (started) return;
  started = true;
  const supabase = browserClient();
  if (!supabase) {
    session = null;
    return;
  }
  supabase.auth.getSession().then(({ data }) => setSession(data.session));
  supabase.auth.onAuthStateChange((event, next) => {
    setSession(next);
    if (event === "SIGNED_IN") void syncAfterSignIn(next);
  });
}

function setSession(next: Session | null) {
  // undefined -> null ("now we know nobody is signed in") is a change too.
  const changed = session === undefined || session?.user.id !== next?.user.id;
  session = next;
  if (changed) listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** undefined until the browser knows whether someone is signed in. */
export function useSession(): Session | null | undefined {
  return useSyncExternalStore(subscribe, () => session, () => undefined);
}

/** Remembers consent given on the login form until the account exists. */
export function rememberConsent() {
  try {
    window.localStorage.setItem(PENDING_CONSENT_KEY, new Date().toISOString());
  } catch {
    // Without storage the consent is recorded again on the next login form.
  }
}

async function syncAfterSignIn(current: Session | null) {
  const supabase = browserClient();
  if (!supabase || !current) return;
  const userId = current.user.id;

  const { data: row } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle<ProfileRow>();
  const remote = row ? fromRow(row) : null;
  const local = readProfile();

  let consentedAt: string | null = row?.consented_at ?? null;
  try {
    consentedAt ??= window.localStorage.getItem(PENDING_CONSENT_KEY);
    window.localStorage.removeItem(PENDING_CONSENT_KEY);
  } catch {
    // ignore
  }

  if (remote) {
    writeLocal(PROFILE_KEY, remote);
  } else {
    await supabase.from("profiles").upsert({
      id: userId,
      ...(local ? toRow(userId, local) : {}),
      consented_at: consentedAt ?? new Date().toISOString(),
      privacy_version: PRIVACY_VERSION,
    });
  }

  // Saved items: union of this browser and the account.
  const { data: savedRows } = await supabase.from("saved_opportunities").select("item_key");
  const remoteKeys = (savedRows ?? []).map((r: { item_key: string }) => r.item_key);
  const localKeys = readSaved();
  const toUpload = localKeys.filter((k) => !remoteKeys.includes(k));
  if (toUpload.length > 0) {
    await supabase.from("saved_opportunities").insert(toUpload.map((item_key) => ({ user_id: userId, item_key })));
  }
  writeLocal(SAVED_KEY, [...new Set([...remoteKeys, ...localKeys])]);
}

// ---- actions used by the UI -----------------------------------------------------------------

export async function saveProfile(profile: Profile | null) {
  writeLocal(PROFILE_KEY, profile);
  const supabase = browserClient();
  if (!supabase || !session || !profile) return;
  await supabase.from("profiles").update(toRow(session.user.id, profile)).eq("id", session.user.id);
}

// ---- weekly e-mail digest (migration 0007) -------------------------------------------------

/** Whether the signed-in person gets the weekly e-mail, and to which address; null without an account. */
export function useAlerts(): { enabled: boolean; email: string } | null {
  const current = useSession();
  const [loaded, setLoaded] = useState<{ userId: string; enabled: boolean } | null>(null);
  useEffect(() => {
    const supabase = browserClient();
    if (!supabase || !current) return;
    let active = true;
    void supabase
      .from("profiles")
      .select("alerts_enabled")
      .eq("id", current.user.id)
      .maybeSingle<{ alerts_enabled: boolean }>()
      .then(({ data }) => {
        if (active) setLoaded({ userId: current.user.id, enabled: data?.alerts_enabled ?? false });
      });
    return () => {
      active = false;
    };
  }, [current]);
  if (!current?.user.email) return null;
  return { enabled: loaded?.userId === current.user.id && loaded.enabled, email: current.user.email };
}

/** Turns the weekly e-mail on (recording when, as the consent) or off. Returns an error message or null. */
export async function setAlerts(enabled: boolean): Promise<string | null> {
  const supabase = browserClient();
  if (!supabase || !session) return "Entre na sua conta para receber o resumo.";
  const { error } = await supabase
    .from("profiles")
    .update(enabled ? { alerts_enabled: true, alerts_enabled_at: new Date().toISOString() } : { alerts_enabled: false })
    .eq("id", session.user.id);
  return error ? "Não foi possível salvar a opção do resumo. Tente de novo." : null;
}

export async function toggleSaved(key: string) {
  const current = readSaved();
  const removing = current.includes(key);
  writeLocal(SAVED_KEY, removing ? current.filter((k) => k !== key) : [...current, key]);
  const supabase = browserClient();
  if (!supabase || !session) return;
  if (removing) {
    await supabase.from("saved_opportunities").delete().eq("item_key", key);
  } else {
    await supabase.from("saved_opportunities").upsert({ user_id: session.user.id, item_key: key });
  }
}

function clearLocal() {
  writeLocal(PROFILE_KEY, null);
  writeLocal(SAVED_KEY, null);
}

export async function signOut() {
  await browserClient()?.auth.signOut();
  clearLocal();
}

export async function deleteAccount(): Promise<string | null> {
  const supabase = browserClient();
  if (!supabase) return "Login indisponível.";
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return error.message;
  // The user no longer exists on the server: only drop the local session.
  await supabase.auth.signOut({ scope: "local" });
  clearLocal();
  return null;
}
