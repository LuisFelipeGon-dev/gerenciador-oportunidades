import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

// The Topa? mark: "topa" in the monospaced face and a "?" drawn in square pixels, the last one in
// the signal color. Colors come from the theme tokens, so one drawing serves both themes.

const Q_PIXELS: [number, number][] = [
  [3.85, 0.25],
  [7.45, 0.25],
  [11.05, 0.25],
  [0.25, 3.85],
  [14.65, 3.85],
  [14.65, 7.45],
  [11.05, 11.05],
  [7.45, 14.65],
];

export function PixelQuestion({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 18.4 25.6" className={`logo-q ${className}`} aria-hidden="true" focusable="false">
      {Q_PIXELS.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="3.4" height="3.4" rx=".7" />
      ))}
      <rect className="dot" x="7.45" y="21.85" width="3.4" height="3.4" rx=".7" />
    </svg>
  );
}

export function BrandLogo() {
  return (
    <span className="flex h-[30px] items-end gap-[3px] text-ink">
      <span className="font-mono text-[26px] leading-6 font-semibold tracking-[-0.07em]">topa</span>
      <PixelQuestion className="mb-px h-[25px] w-[18px] shrink-0 overflow-visible" />
    </span>
  );
}

/** The hero's large "?": a 7x10 grid of dots that light up in a diagonal wave. */
const MATRIX = [".#####.", "#.....#", "#.....#", "......#", ".....#.", "....#..", "...#...", "...#...", ".......", "...#..."];
const CELL = 28;

export function MatrixMark({ className = "" }: { className?: string }) {
  const last = MATRIX.length - 1;
  return (
    <svg
      viewBox={`0 0 ${MATRIX[0].length * CELL} ${MATRIX.length * CELL}`}
      preserveAspectRatio="xMaxYMid meet"
      className={`matrix ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      {MATRIX.flatMap((row, y) =>
        [...row].map((c, x) => {
          const on = c === "#";
          return (
            <circle
              key={`${x}-${y}`}
              className={on && y === last ? "cursor" : on ? "on" : "off"}
              cx={x * CELL + 14}
              cy={y * CELL + 14}
              r={on ? 9 : 2.4}
              style={{ "--k": x + y } as React.CSSProperties}
            />
          );
        }),
      )}
    </svg>
  );
}

/** The top bar of the inner pages (Entrar, Ajustes, Privacidade, cancelar o resumo). */
export function SimpleHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-[var(--bar)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-4 px-4 sm:px-5">
        <Link href="/" aria-label="Topa?, página inicial" className="shrink-0">
          <BrandLogo />
        </Link>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-3 px-4 py-7 text-[13px] text-muted sm:flex-row sm:items-center sm:gap-6 sm:px-5">
        <p className="flex items-center gap-2 font-mono font-semibold tracking-tight text-ink">
          <PixelQuestion className="h-[18px] w-[13px]" />
          Topa?
        </p>
        <p className="max-w-[70ch] leading-relaxed">
          Coletado todo dia do Devpost, da MLH, dos GDGs, do dev.events, do Luma e de páginas oficiais conferidas à mão. O site
          nunca é a fonte final: confira as regras na página oficial.
        </p>
        <nav className="flex gap-4 font-mono text-[12.5px] sm:ml-auto" aria-label="Rodapé">
          <Link href="/ajustes" className="font-semibold hover:text-ink">
            Ajustes
          </Link>
          <Link href="/privacidade" className="font-semibold hover:text-ink">
            Privacidade
          </Link>
        </nav>
      </div>
    </footer>
  );
}
