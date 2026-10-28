// Light, dark or follow the system. The choice lives in this browser (localStorage) and is
// applied as data-theme on <html>; "system" removes the attribute and the CSS media query decides.

export const THEMES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEMES)[number];

export const THEME_KEY = "oportunidades:tema:v1";

/** Runs in <head> before the first paint, so a saved dark theme never flashes light. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export function readTheme(): ThemePreference {
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(theme: ThemePreference) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  try {
    if (theme === "system") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage blocked: the theme still changes until the page reloads.
  }
}
