"use client";

import { useSyncExternalStore } from "react";
import { applyTheme, readTheme, THEME_KEY, type ThemePreference } from "@/lib/theme";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const OPTIONS: { id: ThemePreference; label: string; hint: string }[] = [
  { id: "system", label: "Automático", hint: "Segue o tema do seu celular ou computador" },
  { id: "light", label: "Claro", hint: "Fundo claro o tempo todo" },
  { id: "dark", label: "Escuro", hint: "Fundo escuro, melhor à noite" },
];

/** A tiny drawing of the page in each theme. Colors are literal: it shows the other theme too. */
function Preview({ theme }: { theme: ThemePreference }) {
  const light = { ground: "#eef1f6", card: "#ffffff", line: "#dfe5e3", ink: "#17221f", accent: "#1d4fd8" };
  const dark = { ground: "#0b1220", card: "#131c2e", line: "#26324a", ink: "#e7ecf5", accent: "#7aa2ff" };
  const half = (c: typeof light) => (
    <div className="flex h-full flex-col" style={{ background: c.ground }}>
      <div className="h-3 shrink-0" style={{ background: "#0c2a66" }} />
      <div className="m-1.5 flex flex-1 flex-col gap-1 rounded-md p-1.5" style={{ background: c.card, border: `1px solid ${c.line}` }}>
        <span className="h-1.5 w-3/4 rounded-full" style={{ background: c.ink, opacity: 0.85 }} />
        <span className="h-1.5 w-1/2 rounded-full" style={{ background: c.ink, opacity: 0.35 }} />
        <span className="mt-auto h-2.5 w-1/3 rounded" style={{ background: c.accent }} />
      </div>
    </div>
  );
  return (
    <div aria-hidden="true" className="grid h-24 overflow-hidden rounded-xl border border-line" style={{ gridTemplateColumns: theme === "system" ? "1fr 1fr" : "1fr" }}>
      {theme === "dark" ? half(dark) : half(light)}
      {theme === "system" && half(dark)}
    </div>
  );
}

export function ThemePicker() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as const);

  function choose(next: ThemePreference) {
    applyTheme(next);
    listeners.forEach((l) => l());
  }

  return (
    <fieldset>
      <legend className="text-[17px] font-extrabold tracking-tight">Tema</legend>
      <p className="mt-1 text-[14px] text-muted">Vale só para este navegador.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {OPTIONS.map((o) => (
          <label
            key={o.id}
            className="group cursor-pointer rounded-2xl border border-line bg-card p-3 transition-[border-color,box-shadow] hover:border-ink/40 has-checked:border-action has-checked:shadow-[0_0_0_1px_var(--action),0_8px_24px_-12px_rgb(var(--shadow-rgb)/0.35)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-action"
          >
            <input type="radio" name="theme" value={o.id} checked={theme === o.id} onChange={() => choose(o.id)} className="sr-only" />
            <Preview theme={o.id} />
            <span className="mt-3 flex items-center gap-2 text-[15px] font-bold">
              <span className="grid size-4 place-items-center rounded-full border-2 border-line group-has-checked:border-action">
                <span className="size-2 rounded-full bg-action opacity-0 group-has-checked:opacity-100" />
              </span>
              {o.label}
            </span>
            <span className="mt-0.5 block pl-6 text-[13px] text-muted">{o.hint}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
