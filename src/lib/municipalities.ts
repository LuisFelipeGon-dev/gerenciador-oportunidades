"use client";

import { useEffect, useState } from "react";
import { isUF } from "./brazil";
import { findMunicipality, type Municipality, type MunicipalityRow } from "./geo";
import type { Profile } from "./personalize";

// The municipalities of one state, loaded from public/municipios/<UF>.json on demand.
// The person's city is looked up here, in the browser: it is never sent anywhere.

const cache = new Map<string, Promise<MunicipalityRow[]>>();

function load(uf: string): Promise<MunicipalityRow[]> {
  let pending = cache.get(uf);
  if (!pending) {
    pending = fetch(`/municipios/${uf}.json`)
      .then((res) => (res.ok ? (res.json() as Promise<MunicipalityRow[]>) : []))
      .catch(() => {
        cache.delete(uf); // try again on the next use
        return [];
      });
    cache.set(uf, pending);
  }
  return pending;
}

/** The municipalities of a state, or null while loading (or for an unknown state). */
export function useMunicipalities(uf: string | null | undefined): MunicipalityRow[] | null {
  const [loaded, setLoaded] = useState<{ uf: string; rows: MunicipalityRow[] } | null>(null);
  useEffect(() => {
    if (!isUF(uf)) return;
    let active = true;
    void load(uf).then((rows) => {
      if (active) setLoaded({ uf, rows });
    });
    return () => {
      active = false;
    };
  }, [uf]);
  return loaded && loaded.uf === uf ? loaded.rows : null;
}

/** Where the profile's city is on the map, or null when it is not in the IBGE list. */
export function useProfilePlace(profile: Profile | null | undefined): Municipality | null {
  const rows = useMunicipalities(profile?.state);
  return rows && profile ? findMunicipality(rows, profile.city) : null;
}
