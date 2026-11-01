"use client";

import { applyTheme } from "@/lib/theme";

function isDarkNow(): boolean {
  const set = document.documentElement.getAttribute("data-theme");
  if (set) return set === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Flips between light and dark; "Automático" stays available in Ajustes. */
export function ThemeToggle() {
  return (
    <button
      type="button"
      onClick={() => applyTheme(isDarkNow() ? "light" : "dark")}
      aria-label="Alternar tema claro e escuro"
      title="Alternar tema"
      className="grid size-10 shrink-0 place-items-center rounded-md border border-line text-ink transition-[border-color,background-color,transform] hover:border-line-strong hover:bg-card active:scale-95"
    >
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" />
      </svg>
    </button>
  );
}
