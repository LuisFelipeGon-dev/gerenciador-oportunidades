"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toggleSaved, toggleWatch, useSession } from "@/lib/account";
import { agendaEntries, type AgendaFilter } from "@/lib/agenda";
import { aliasKeys } from "@/lib/dedupe";
import { areaById } from "@/lib/areas";
import { regionOf, stateName } from "@/lib/brazil";
import { useProfile, useSaved, useWatching } from "@/lib/local-store";
import { useProfilePlace } from "@/lib/municipalities";
import type { Opportunity, OpportunityType } from "@/lib/opportunity";
import { buildSections, checksFor, effectiveInterests, isExcluded, itemKey, keyDate, localToday, type Profile } from "@/lib/personalize";
import { fitOf, matchesQuery } from "@/lib/search";
import { AgendaCalendar } from "./agenda-calendar";
import { BrandLogo, MatrixMark } from "./brand";
import { CompactRow, OpportunityCard, ProgramCard, type CardActions } from "./cards";
import { DeadlinePanel, DeadlineStrip } from "./deadline-panel";
import { DetailDrawer } from "./detail-drawer";
import { MODALITY_LABEL, TYPE_LABEL, TYPE_PLURAL } from "./format";
import { ProfileForm } from "./profile-form";
import { ProfileMenu } from "./profile-menu";
import { ThemeToggle } from "./theme-toggle";

type Tab = "for-you" | "hackathon" | "event" | "programs" | "agenda";
const TABS: { id: Tab; label: string }[] = [
  { id: "for-you", label: "Para você" },
  { id: "hackathon", label: TYPE_PLURAL.hackathon },
  { id: "event", label: TYPE_PLURAL.event },
  { id: "programs", label: "Programas" },
  { id: "agenda", label: "Agenda" },
];

const AGENDA_FILTERS: { id: AgendaFilter; label: string }[] = [
  { id: "all", label: "Tudo" },
  { id: "near", label: "Perto de mim" },
  { id: "online", label: "Online" },
  { id: "saved", label: "Salvos" },
];

// The open item lives in the URL hash (#o=source:id): shareable, and "back" closes it.
function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}
const readHash = () => window.location.hash;

function openItem(o: Opportunity) {
  window.location.hash = `o=${itemKey(o)}`;
}
function closeItem() {
  if (!window.location.hash) return;
  history.replaceState(null, "", window.location.pathname + window.location.search);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The headline types itself out when it changes (the personalized one replacing the generic one). */
function HeroTitle({ text, accent }: { text: string; accent: string }) {
  const [prev, setPrev] = useState(text);
  const [typed, setTyped] = useState<number | null>(null);
  if (text !== prev) {
    setPrev(text);
    setTyped(reducedMotion() ? null : 0);
  }
  useEffect(() => {
    if (typed === null) return;
    const step = typed % 9 === 8 ? 2 : 1;
    const t = window.setTimeout(() => setTyped(typed + step >= text.length ? null : typed + step), 26);
    return () => window.clearTimeout(t);
  }, [typed, text]);

  const [before, ...after] = text.split(accent);
  return (
    <h1
      aria-label={text}
      className={`type-cursor ${typed !== null ? "typing" : ""} max-w-[24ch] font-mono text-[clamp(26px,3.7vw,40px)] leading-[1.2] font-semibold tracking-[-0.05em] text-balance`}
    >
      <span aria-hidden="true">
        {typed !== null ? (
          text.slice(0, typed)
        ) : after.length > 0 ? (
          <>
            {before}
            <span className="text-action">{accent}</span>
            {after.join(accent)}
          </>
        ) : (
          text
        )}
      </span>
    </h1>
  );
}

/** A number that counts up from where it was to its new value. */
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = from.current;
    const duration = reducedMotion() ? 0 : 900;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = duration ? Math.min(1, (t - t0) / duration) : 1;
      const v = Math.round(start + (value - start) * (1 - (1 - p) ** 3));
      from.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{shown}</>;
}

function SectionHeader({ title, count, hint }: { title: string; count?: number; hint?: string }) {
  return (
    <div className="sec-rule mb-[18px] flex flex-wrap items-baseline gap-x-3 gap-y-1 pb-3.5">
      <h2 className="font-mono text-[18px] leading-[26px] font-semibold tracking-[-0.045em] text-balance sm:text-[20px] sm:leading-7">{title}</h2>
      {count !== undefined && <span className="font-mono text-[13px] font-semibold text-muted tabular-nums">{count}</span>}
      {hint && <p className="basis-full text-[13.5px] leading-5 text-muted">{hint}</p>}
    </div>
  );
}

function ShowMore({ total, shown, onMore }: { total: number; shown: number; onMore: () => void }) {
  if (shown >= total) return null;
  const rest = total - shown;
  return (
    <button
      type="button"
      onClick={onMore}
      className="mt-2 inline-flex min-h-11 items-center font-mono text-[13px] font-semibold tracking-tight text-action underline underline-offset-4 hover:text-action-strong"
    >
      {rest <= 10 ? `Ver mais ${rest}` : `Ver mais 10 de ${rest}`}
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="grid-bg rounded-lg border border-dashed border-line-strong bg-card px-5 py-7 text-center text-[14px] text-muted">{children}</p>;
}

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex h-11 items-center gap-2 rounded-md border px-4 font-mono text-[12.5px] font-semibold tracking-tight transition-[background-color,border-color,color,transform] active:scale-[.97] ${
        pressed ? "border-action bg-sky-tint text-ink" : "border-line text-muted hover:border-line-strong hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

const primaryButton =
  "inline-flex h-11 items-center justify-center gap-2 rounded-md bg-btn px-[18px] font-mono text-[13px] font-semibold tracking-tight text-on-btn transition-[background-color,box-shadow,transform] hover:bg-btn-hover hover:shadow-[0_6px_22px_-10px_var(--btn)] active:scale-[.98]";
const ghostButton =
  "inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line-strong px-[18px] font-mono text-[13px] font-semibold tracking-tight text-ink transition-colors hover:border-action hover:bg-sky-tint";

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

/**
 * What the server renders, before this browser's profile is read: the open items in date order.
 * Without it, slow connections saw only "Carregando…" until the JavaScript arrived.
 */
function ServerList({ items, programs, actions }: { items: Opportunity[]; programs: Opportunity[]; actions: CardActions }) {
  const open = programs.filter((o) => o.status === "open");
  return (
    <section>
      <SectionHeader title="Abertas agora" count={items.length + open.length} hint="Do prazo mais próximo ao mais distante. Com o seu perfil, a página mostra primeiro o que serve pra você." />
      <div className="stack">
        {items.slice(0, 10).map((o) => (
          <OpportunityCard key={itemKey(o)} o={o} today={null} profile={null} actions={actions} />
        ))}
      </div>
      {open.length > 0 && (
        <div className="stack mt-6">
          {open.map((o) => (
            <ProgramCard key={itemKey(o)} o={o} actions={actions} />
          ))}
        </div>
      )}
    </section>
  );
}

const SUGGEST_URL = "https://github.com/LuisFelipeGon-dev/gerenciador-oportunidades/issues/new";

function distanceWhy(km: number, city: string): string {
  return km < 1 ? `Em ${city}, a sua cidade.` : `A ${Math.round(km)} km de ${city}.`;
}

export function Home({ items, programs }: { items: Opportunity[]; programs: Opportunity[] }) {
  const profile = useProfile();
  const hydrated = profile !== undefined;
  const p: Profile | null = profile ?? null;
  const place = useProfilePlace(p);
  const savedKeys = useSaved();
  const watchingKeys = useWatching();
  const session = useSession();
  const hash = useSyncExternalStore(subscribeHash, readHash, () => "");
  const [tab, setTab] = useState<Tab>("for-you");
  const [modeFilter, setModeFilter] = useState<"all" | "online" | "in_person">("all");
  const [agendaFilter, setAgendaFilter] = useState<AgendaFilter>("all");
  const [profileOpen, setProfileOpen] = useState(false);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [fitOnly, setFitOnly] = useState(false);
  const [tabEdges, setTabEdges] = useState({ left: false, right: false });
  const tabsRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const today = hydrated ? localToday() : null;
  const all = useMemo(() => [...items, ...programs], [items, programs]);
  // Keys of items merged by dedupe() still open (and keep saved) the item that was kept.
  const byKey = useMemo(() => new Map([...aliasKeys(all), ...all.map((o) => [itemKey(o), o] as const)]), [all]);
  const openKey = hash.startsWith("#o=") ? decodeURIComponent(hash.slice(3)) : null;
  const opened = openKey ? (byKey.get(openKey) ?? null) : null;

  const sections = useMemo(
    () => buildSections(items, programs, p, today ?? "1970-01-01", place),
    [items, programs, p, today, place],
  );
  const saved = savedKeys.map((k) => byKey.get(k)).filter((o): o is Opportunity => !!o);
  const agenda = useMemo(
    () =>
      tab === "agenda" && today
        ? agendaEntries({ items, programs, profile: p, today, origin: place, filter: agendaFilter, savedKeys })
        : [],
    [tab, items, programs, p, today, place, agendaFilter, savedKeys],
  );
  const area = p ? areaById(p.area) : null;
  const interests = effectiveInterests(p);

  const actions: CardActions = {
    onOpen: openItem,
    onToggleSave: (o) => toggleSaved(itemKey(o)),
    isSaved: (o) => savedKeys.includes(itemKey(o)),
    isWatching: (o) => watchingKeys.includes(itemKey(o)),
    onToggleWatch: (o) => void toggleWatch(itemKey(o)),
  };

  const limit = (id: string, base: number) => limits[id] ?? base;
  const more = (id: string, base: number) => setLimits((l) => ({ ...l, [id]: (l[id] ?? base) + 10 }));

  const openPrograms = sections.programs.filter((o) => o.status === "open").length;
  const near = sections.nearby.slice(0, sections.nearbyWithin);
  const matching = new Set([...near, ...sections.online].map(itemKey)).size + openPrograms;
  const nearbyWhere =
    p && sections.nearbyScope === "radius"
      ? `até ${p.radiusKm} km`
      : p && sections.nearbyScope === "state"
      ? `em ${p.state}`
      : p && sections.nearbyScope === "region"
        ? `no ${regionOf(p.state)}`
        : "no Brasil";

  const timeline = (saved.length > 0 ? saved : [...sections.closingSoon, ...near])
    .filter((o) => keyDate(o) && (!today || keyDate(o)! >= today))
    .sort((a, b) => keyDate(a)!.localeCompare(keyDate(b)!))
    .filter((o, i, list) => list.findIndex((x) => itemKey(x) === itemKey(o)) === i)
    .slice(0, 5);

  const ofType = (type: OpportunityType) => items.filter((o) => o.type === type && !isExcluded(o, p, today ?? "1970-01-01"));
  const tabCount: Partial<Record<Tab, number>> = hydrated
    ? { "for-you": matching, hackathon: ofType("hackathon").length, event: ofType("event").length, programs: sections.programs.length }
    : {};

  const filtering = query.trim() !== "" || fitOnly || modeFilter !== "all";
  const passes = (o: Opportunity) =>
    matchesQuery(o, query, `${TYPE_LABEL[o.type]} ${MODALITY_LABEL[o.modality]}`) &&
    (modeFilter === "all" || (modeFilter === "online" ? o.modality === "online" : o.modality !== "online")) &&
    (!fitOnly || !p || fitOf(checksFor(o, p, today ?? "1970-01-01")) !== "no");
  const byDate = (a: Opportunity, b: Opportunity) => (keyDate(a) ?? "9999").localeCompare(keyDate(b) ?? "9999");

  const tabItems =
    tab === "for-you" || tab === "agenda" ? [] : (tab === "programs" ? sections.programs : ofType(tab)).filter(passes).sort(byDate);
  const results =
    tab === "for-you" && filtering
      ? [...items.filter((o) => !isExcluded(o, p, today ?? "1970-01-01")), ...sections.programs].filter(passes).sort(byDate)
      : [];
  const clearFilters = () => {
    setQuery("");
    setFitOnly(false);
    setModeFilter("all");
  };

  // "/" or Ctrl+K (⌘K) jumps to the search from anywhere outside a text field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.closest?.("input, textarea, select, [contenteditable='true']");
      const combo = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (!combo && (typing || e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey)) return;
      if (document.querySelector("dialog[open]")) return;
      e.preventDefault();
      setTab((t) => (t === "agenda" ? "for-you" : t));
      requestAnimationFrame(() => searchRef.current?.focus());
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // On phones the tab row scrolls sideways; its edges fade where more tabs are hidden.
  useEffect(() => {
    const row = tabsRef.current;
    if (!row) return;
    const measure = () => {
      const max = row.scrollWidth - row.clientWidth;
      setTabEdges({ left: row.scrollLeft > 4, right: max - row.scrollLeft > 4 });
    };
    measure();
    row.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      row.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [hydrated]);

  // The glowing line under the current tab slides to it; on phones the tab row also scrolls to it.
  useLayoutEffect(() => {
    const row = tabsRef.current;
    const bar = indicatorRef.current;
    const current = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!row || !bar || !current) return;
    const place = () => {
      bar.style.width = `${current.offsetWidth}px`;
      bar.style.transform = `translateX(${current.offsetLeft}px)`;
    };
    place();
    if (row.scrollWidth > row.clientWidth) {
      row.scrollTo({ left: current.offsetLeft - 16, behavior: reducedMotion() ? "auto" : "smooth" });
    }
    window.addEventListener("resize", place);
    void document.fonts?.ready.then(place);
    return () => window.removeEventListener("resize", place);
  }, [tab, hydrated]);

  // The light under the pointer on cards, panels and the hero.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>(".spot");
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => document.removeEventListener("pointermove", onMove);
  }, []);

  const heroText = p
    ? `${p.name ? `${greeting()}, ${p.name}. ` : ""}Tem ${matching} oportunidades abertas que combinam com você.`
    : "Hackathons, eventos e programas abertos pra estudantes, num só lugar.";
  const heroAccent = p ? `${matching} oportunidades` : "abertos pra estudantes";

  const stats = [
    { n: sections.closingSoon.length, l: "fecham nesta semana", warn: true },
    { n: sections.nearbyWithin, l: `presenciais ${nearbyWhere}`, warn: false },
    { n: sections.online.length, l: "online pra você", warn: false },
    { n: openPrograms, l: "programas abertos", warn: false },
  ];

  const profileIncomplete = p && (!p.institution || !p.campus);

  return (
    <>
      <a
        href="#conteudo"
        className="absolute -top-16 left-3 z-[70] rounded-sm bg-action px-4 py-2.5 text-[14px] font-bold text-card focus:top-3"
      >
        Ir para o conteúdo
      </a>
      <div className="scroll-progress" aria-hidden="true" />

      <header className="z-30 border-b border-line bg-[var(--bar)] backdrop-blur-md md:sticky md:top-0">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-5">
          <nav className="flex flex-wrap items-center gap-x-3 pt-2 md:h-16 md:flex-nowrap md:gap-x-7 md:pt-0" aria-label="Principal">
            <Link href="/" onClick={() => setTab("for-you")} aria-label="Topa?, página inicial" className="flex h-11 shrink-0 items-center">
              <BrandLogo />
            </Link>
            <div
              ref={tabsRef}
              style={
                tabEdges.left || tabEdges.right
                  ? {
                      maskImage: `linear-gradient(90deg, ${tabEdges.left ? "transparent, #000 40px" : "#000, #000"}, #000 calc(100% - ${tabEdges.right ? "48px" : "0px"}), ${tabEdges.right ? "transparent" : "#000"})`,
                    }
                  : undefined
              }
              className="relative order-3 -mx-4 flex h-12 w-[calc(100%+2rem)] gap-0.5 overflow-x-auto px-4 [scrollbar-width:none] md:order-none md:mx-0 md:h-full md:w-auto md:min-w-0 md:flex-1 md:px-0 [&::-webkit-scrollbar]:hidden"
            >
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  aria-current={tab === t.id ? "page" : undefined}
                  className={`relative h-full shrink-0 px-3.5 font-mono text-[13px] font-semibold tracking-tight transition-colors ${
                    tab === t.id ? "text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  {t.label}
                  {tabCount[t.id] !== undefined && (
                    <span
                      className={`ml-1.5 rounded-sm bg-sky-tint px-[5px] align-[1px] text-[10.5px] leading-4 tabular-nums ${tab === t.id ? "text-ink" : "text-muted"}`}
                    >
                      {tabCount[t.id]}
                    </span>
                  )}
                </button>
              ))}
              <span
                ref={indicatorRef}
                aria-hidden="true"
                className="tab-indicator pointer-events-none absolute bottom-0 left-0 h-0.5 w-0 rounded-sm bg-action"
              />
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <ThemeToggle />
              {session === null && (
                <Link
                  href="/entrar"
                  className="inline-flex h-10 items-center rounded-md border border-line px-3.5 font-mono text-[13px] font-semibold tracking-tight hover:border-line-strong hover:bg-card"
                >
                  Entrar
                </Link>
              )}
              <ProfileMenu profile={p} onEditProfile={() => setProfileOpen(true)} />
            </div>
          </nav>
        </div>
      </header>

      <section className="grid-bg spot spot-lg relative overflow-hidden border-b border-line" aria-label="Resumo">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-[35%] -right-[6%] -z-10 size-[620px] max-w-full bg-[radial-gradient(closest-side,var(--glow),transparent)]"
        />
        <div className="hero-parallax relative mx-auto max-w-[1120px] px-4 sm:px-5">
          <div className="flex flex-wrap items-end gap-x-12 gap-y-6 py-7 sm:gap-y-9 sm:py-9 md:py-14">
            <div className="min-w-0 basis-full">
              <HeroTitle text={heroText} accent={heroAccent} />
              <p className={`mt-4 max-w-[56ch] text-[15px] leading-[23px] text-muted sm:block sm:text-[16px] sm:leading-[25px] ${p ? "hidden" : ""}`}>
                {p
                  ? `Montado a partir do seu perfil: ${p.course} (${area!.label.toLowerCase()}), ${p.city} (${p.state}). Tudo leva à página oficial.`
                  : "Monte seu perfil em 30 segundos e a página passa a mostrar o que serve pra você: perto da sua cidade, no seu nível, no prazo."}
              </p>
              {hydrated && !p && (
                <button type="button" onClick={() => setProfileOpen(true)} className={`${primaryButton} mt-5`}>
                  Montar meu perfil
                </button>
              )}
            </div>
            {hydrated && (
              <dl className="grid w-full grid-cols-4 animate-[rise_.6s_var(--ease-out-soft)_both] sm:flex sm:w-auto">
                {stats.map((s) => (
                  <div
                    key={s.l}
                    className="flex min-w-0 flex-col-reverse justify-end border-l border-line px-2.5 first:border-l-0 first:pl-0 sm:min-w-[120px] sm:px-7"
                  >
                    <dt className="mt-1 max-w-[15ch] text-[11px] leading-[14px] text-muted sm:mt-1.5 sm:text-[12.5px] sm:leading-[18px]">{s.l}</dt>
                    <dd className={`font-mono text-[24px] leading-7 font-semibold tracking-[-0.04em] tabular-nums sm:text-[36px] sm:leading-[38px] ${s.warn ? "text-urgent" : ""}`}>
                      <CountUp value={s.n} />
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            <MatrixMark className="pointer-events-none absolute top-14 right-5 hidden h-[calc(100%-108px)] max-h-[380px] w-auto min-[900px]:block" />
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-8 px-4 pt-8 pb-20 sm:px-5 lg:flex-row lg:items-start lg:gap-10 lg:pt-12">
        <main id="conteudo" tabIndex={-1} className="order-2 min-w-0 flex-1 outline-none lg:order-1">
          {!hydrated ? (
            <ServerList items={items} programs={programs} actions={actions} />
          ) : (
            <>
          {tab !== "agenda" && (
            <div className="mb-10 flex flex-wrap items-center gap-2.5" role="search">
              <div className="relative min-w-0 flex-[1_1_100%]">
                <SearchIcon />
                <label htmlFor="busca" className="sr-only">
                  Buscar oportunidades
                </label>
                <input
                  ref={searchRef}
                  id="busca"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setQuery("");
                      e.currentTarget.blur();
                    }
                  }}
                  placeholder="Buscar por nome, cidade ou tema"
                  autoComplete="off"
                  className="h-11 w-full rounded-md border border-line bg-card pr-3.5 pl-10 text-[14.5px] transition-[border-color,box-shadow] placeholder:text-muted hover:border-line-strong focus-visible:border-action focus-visible:shadow-[0_0_0_3px_var(--sky-tint)] focus-visible:outline-none sm:pr-12"
                />
                <span aria-hidden="true" className={`pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 gap-1 ${query ? "" : "sm:flex"}`}>
                  <kbd className="rounded-[3px] border border-b-2 border-line bg-surface px-1.5 font-mono text-[11px] leading-[18px] text-muted">/</kbd>
                </span>
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filtros">
                <Chip pressed={modeFilter === "in_person"} onClick={() => setModeFilter((m) => (m === "in_person" ? "all" : "in_person"))}>
                  Presencial
                </Chip>
                <Chip pressed={modeFilter === "online"} onClick={() => setModeFilter((m) => (m === "online" ? "all" : "online"))}>
                  Online
                </Chip>
                {p && (
                  <Chip pressed={fitOnly} onClick={() => setFitOnly((v) => !v)}>
                    Combina comigo
                  </Chip>
                )}
              </div>
              {filtering && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="ml-auto inline-flex min-h-11 items-center font-mono text-[12.5px] font-semibold tracking-tight text-action underline underline-offset-4"
                >
                  Limpar
                </button>
              )}
            </div>
          )}
          {tab === "for-you" && filtering ? (
            <section aria-live="polite">
              <SectionHeader
                title="Resultados"
                count={results.length}
                hint={query.trim() ? `Para “${query.trim()}”, do prazo mais próximo ao mais distante.` : "Do prazo mais próximo ao mais distante."}
              />
              {results.length === 0 ? (
                <Empty>
                  Nada combina com essa busca.{" "}
                  <button type="button" onClick={clearFilters} className="font-semibold text-action underline underline-offset-4">
                    Limpar filtros
                  </button>
                </Empty>
              ) : (
                <>
                  <div className="stack">
                    {results.slice(0, limit("results", 12)).map((o) => (
                      <OpportunityCard key={itemKey(o)} o={o} today={today} profile={p} actions={actions} />
                    ))}
                  </div>
                  <ShowMore total={results.length} shown={limit("results", 12)} onMore={() => more("results", 12)} />
                </>
              )}
            </section>
          ) : tab === "for-you" ? (
            <>
              <DeadlineStrip
                title={saved.length > 0 ? "Prazos dos seus salvos" : "Próximos prazos"}
                items={timeline}
                today={today}
                onOpen={openItem}
                onSeeAgenda={() => setTab("agenda")}
              />
              {profileIncomplete && (
                <section className="mb-8 flex flex-wrap items-center gap-3 rounded-md border border-line-strong bg-sky-tint px-4 py-3 lg:hidden">
                  <p className="min-w-0 flex-1 text-[13.5px] leading-5">
                    <span className="font-semibold">Complete seu perfil:</span> <span className="text-muted">com instituição e câmpus, os editais dela aparecem aqui.</span>
                  </p>
                  <button type="button" onClick={() => setProfileOpen(true)} className={`${primaryButton} h-10 px-3.5`}>
                    Completar
                  </button>
                </section>
              )}
              {saved.length > 0 && (
                <section className="reveal mb-12">
                  <SectionHeader title="Salvos" count={saved.length} hint={session ? "Guardados na sua conta." : "Guardados neste navegador."} />
                  <ul className="grid-bg spot overflow-hidden rounded-lg border border-line bg-card">
                    {saved.map((o) => (
                      <CompactRow key={itemKey(o)} o={o} today={today} actions={actions} />
                    ))}
                  </ul>
                </section>
              )}

              {area && !area.techIsCore && (
                <section className="reveal grid-bg spot mb-12 rounded-lg border border-line bg-card p-5" aria-labelledby="area-title">
                  <p className="font-mono text-[12px] font-semibold tracking-tight text-prog uppercase">{area.label}</p>
                  <h2 id="area-title" className="mt-1 font-mono text-[18px] leading-[26px] font-semibold tracking-[-0.045em]">
                    Ainda não temos oportunidades específicas de {p!.course}
                  </h2>
                  <p className="mt-1.5 max-w-[65ch] text-[14.5px] text-muted">
                    Por enquanto as fontes são de tecnologia. Abaixo ficam só os {interests!.map((t) => TYPE_PLURAL[t].toLowerCase()).join(" e ")}{" "}
                    abertos a qualquer curso. Queremos incluir {area.missing}.
                  </p>
                  <a
                    href={`${SUGGEST_URL}?${new URLSearchParams({ title: `Sugestão de fonte: ${area.label}`, labels: "sugestao-de-fonte", body: `Curso: ${p!.course}\nSite ou página com oportunidades:\n` })}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${ghostButton} mt-4`}
                  >
                    Sugerir um site da sua área
                  </a>
                </section>
              )}

              {(sections.closingSoon.length > 0 || !area || area.techIsCore) && (
                <section className="reveal mb-12">
                  <SectionHeader title="Fecha esta semana" count={sections.closingSoon.length} hint="Inscrições que encerram nos próximos 7 dias." />
                  {sections.closingSoon.length === 0 ? (
                    <Empty>Nada fechando nos próximos 7 dias. Bom momento pra olhar com calma o resto.</Empty>
                  ) : (
                    <>
                      <div className="stack">
                        {sections.closingSoon.slice(0, limit("soon", 3)).map((o) => (
                          <OpportunityCard key={itemKey(o)} o={o} today={today} profile={p} actions={actions} />
                        ))}
                      </div>
                      <ShowMore total={sections.closingSoon.length} shown={limit("soon", 3)} onMore={() => more("soon", 3)} />
                    </>
                  )}
                </section>
              )}

              <section className="reveal mb-12">
                <SectionHeader
                  title={
                    p && place && sections.nearbyScope === "radius"
                      ? `Perto de você, até ${p.radiusKm} km de ${place.name}`
                      : p && sections.nearbyScope === "state"
                      ? `Perto de você, em ${stateName(p.state)}`
                      : p && sections.nearbyScope === "region"
                        ? `Na sua região, ${regionOf(p.state)}`
                        : "Presenciais no Brasil"
                  }
                  count={sections.nearbyWithin}
                  hint={
                    p && sections.nearbyScope === "radius"
                      ? sections.nearbyWithin > 0
                        ? "Do mais perto ao mais longe; depois, o resto do Brasil."
                        : `Nada presencial até ${p.radiusKm} km agora; estes são os mais perto.`
                      : p && sections.nearbyScope === "state"
                      ? "Primeiro no seu estado, depois na sua região."
                      : p && sections.nearbyScope === "region"
                        ? `Nada presencial em ${p.state} agora; estes são os mais perto.`
                        : p
                          ? "Nada presencial na sua região agora."
                          : "Monte seu perfil para ver o que está perto de você."
                  }
                />
                {sections.nearby.length === 0 ? (
                  <Empty>Nenhum evento presencial no Brasil com data marcada agora.</Empty>
                ) : (
                  <>
                    <div className="stack">
                      {sections.nearby.slice(0, limit("near", 4)).map((o) => (
                        <OpportunityCard
                          key={itemKey(o)}
                          o={o}
                          today={today}
                          profile={p}
                          actions={actions}
                          why={
                            place && sections.distances.has(itemKey(o))
                              ? distanceWhy(sections.distances.get(itemKey(o))!, place.name)
                              : p && o.location.state === p.state
                              ? `Aparece pra você porque é em ${p.state}, o seu estado.`
                              : undefined
                          }
                        />
                      ))}
                    </div>
                    <ShowMore total={sections.nearby.length} shown={limit("near", 4)} onMore={() => more("near", 4)} />
                  </>
                )}
              </section>

              {(sections.online.length > 0 || !area || area.techIsCore) && (
                <section className="reveal mb-12">
                  <SectionHeader title="Online, de onde você estiver" count={sections.online.length} hint="Abertos pra você, sem sair de casa." />
                  {sections.online.length === 0 ? (
                    <Empty>Nenhuma oportunidade online combina com o seu perfil agora.</Empty>
                  ) : (
                    <>
                      <ul className="grid-bg spot overflow-hidden rounded-lg border border-line bg-card">
                        {sections.online.slice(0, limit("online", 8)).map((o) => (
                          <CompactRow key={itemKey(o)} o={o} today={today} actions={actions} />
                        ))}
                      </ul>
                      <ShowMore total={sections.online.length} shown={limit("online", 8)} onMore={() => more("online", 8)} />
                    </>
                  )}
                </section>
              )}

              {sections.programs.length > 0 && (
                <section className="reveal">
                  <SectionHeader
                    title="Programas pra ficar de olho"
                    count={sections.programs.length}
                    hint="Abrem uma vez por ano. Os fechados mostram quando costumam abrir."
                  />
                  <div className="stack">
                    {sections.programs.map((o) => (
                      <ProgramCard key={itemKey(o)} o={o} today={today} actions={actions} />
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : tab === "agenda" ? (
            <section>
              <SectionHeader
                title="Agenda"
                count={agenda.length}
                hint={
                  p
                    ? place
                      ? `Eventos online, presenciais até ${p.radiusKm} km de ${place.name} e prazos, do mais próximo ao mais distante.`
                      : `Eventos online, presenciais em ${p.state} e prazos, do mais próximo ao mais distante.`
                    : "Monte seu perfil para ver só o que serve pra você."
                }
              />
              <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filtrar agenda">
                {AGENDA_FILTERS.map((f) => (
                  <Chip key={f.id} pressed={agendaFilter === f.id} onClick={() => setAgendaFilter(f.id)}>
                    {f.label}
                    {f.id === "saved" && <span className="text-muted tabular-nums">{savedKeys.length}</span>}
                  </Chip>
                ))}
              </div>
              {agendaFilter === "saved" && agenda.length === 0 && (
                <p className="mb-4 text-[13.5px] text-muted">Nada salvo com data marcada. Salve um evento para ele aparecer aqui.</p>
              )}
              {today && <AgendaCalendar entries={agenda} today={today} profile={p} actions={actions} />}
            </section>
          ) : (
            <section>
              <SectionHeader
                title={tab === "programs" ? "Programas" : TYPE_PLURAL[tab as OpportunityType]}
                count={tabItems.length}
                hint={tab === "programs" ? "Embaixadores, competições, estágios e bolsas que abrem todo ano." : "Da data mais próxima à mais distante."}
              />
              {tabItems.length === 0 ? (
                <Empty>{filtering ? "Nada aqui combina com a busca e os filtros." : "Nada aberto aqui agora."}</Empty>
              ) : tab === "programs" ? (
                <div className="stack">
                  {tabItems.map((o) => (
                    <ProgramCard key={itemKey(o)} o={o} today={today} actions={actions} />
                  ))}
                </div>
              ) : (
                <>
                  <div className="stack">
                    {tabItems.slice(0, limit(tab, 12)).map((o) => (
                      <OpportunityCard key={itemKey(o)} o={o} today={today} profile={p} actions={actions} />
                    ))}
                  </div>
                  <ShowMore total={tabItems.length} shown={limit(tab, 12)} onMore={() => more(tab, 12)} />
                </>
              )}
            </section>
          )}
            </>
          )}
        </main>

        {hydrated && (
          <aside
            aria-label="Prazos e perfil"
            className="hidden flex-col gap-4 lg:sticky lg:top-24 lg:order-2 lg:flex lg:max-h-[calc(100dvh-112px)] lg:w-[320px] lg:shrink-0 lg:overflow-y-auto lg:[scrollbar-width:thin]"
          >
            <DeadlinePanel
              title={saved.length > 0 ? "Prazos dos seus salvos" : "Próximos prazos"}
              subtitle={saved.length > 0 ? "Do que você guardou, o que acontece primeiro." : "As inscrições e os eventos mais perto de acontecer."}
              items={timeline}
              today={today}
              onOpen={openItem}
              onSeeAgenda={() => setTab("agenda")}
            />
            {!p ? (
              <section className="hidden rounded-lg border border-line-strong bg-sky-tint p-5 lg:block" aria-labelledby="nudge-title">
                <h2 id="nudge-title" className="font-mono text-[15px] leading-[22px] font-semibold tracking-[-0.045em]">
                  Monte seu perfil
                </h2>
                <p className="mt-1.5 text-[13.5px] leading-5 text-muted">Curso, cidade e nível: a página passa a mostrar só o que serve pra você.</p>
                <button type="button" onClick={() => setProfileOpen(true)} className={`${primaryButton} mt-3.5`}>
                  Montar perfil
                </button>
              </section>
            ) : profileIncomplete ? (
              <section className="rounded-lg border border-line-strong bg-sky-tint p-5" aria-labelledby="nudge-title">
                <h2 id="nudge-title" className="font-mono text-[15px] leading-[22px] font-semibold tracking-[-0.045em]">
                  Complete seu perfil
                </h2>
                <p className="mt-1.5 text-[13.5px] leading-5 text-muted">
                  Com a instituição de ensino e o câmpus, os editais da sua instituição aparecem aqui.
                </p>
                <button type="button" onClick={() => setProfileOpen(true)} className={`${primaryButton} mt-3.5`}>
                  Completar perfil
                </button>
              </section>
            ) : (
              <section className="hidden rounded-lg border border-line bg-card p-5 lg:block" aria-labelledby="nudge-title">
                <h2 id="nudge-title" className="font-mono text-[15px] leading-[22px] font-semibold tracking-[-0.045em]">
                  Perfil completo
                </h2>
                <p className="mt-1.5 text-[13.5px] leading-5 text-muted">
                  Mostrando editais de {p.institution}, câmpus {p.campus}.
                </p>
                <button type="button" onClick={() => setProfileOpen(true)} className={`${ghostButton} mt-3.5`}>
                  Editar perfil
                </button>
              </section>
            )}
          </aside>
        )}
      </div>

      {today && <DetailDrawer o={opened} today={today} profile={p} actions={actions} signedIn={!!session} onClose={closeItem} />}
      <ProfileForm open={profileOpen} initial={p} onClose={() => setProfileOpen(false)} />
    </>
  );
}
