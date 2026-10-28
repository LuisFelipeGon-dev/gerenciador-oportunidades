"use client";

import { useMemo, useState } from "react";
import { activeOn, calendarColors, groupAgenda, isLongOnline, monthGrid, weekBars, type AgendaEntry, type CalendarDay } from "@/lib/agenda";
import type { Profile } from "@/lib/personalize";
import { AgendaRow, OpportunityCard, type CardActions } from "./cards";
import { longDate, shortDate, whatItIs } from "./format";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

type View = "month" | "year" | "list";

const VIEWS: { id: View; label: string }[] = [
  { id: "month", label: "Mês" },
  { id: "year", label: "Ano" },
  { id: "list", label: "Lista" },
];

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
/** Bars shown per week; the rest of the long events count in the day's "+N". */
const MAX_LANES = 3;
const MAX_CHIPS = 2;

const monthFormat = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });
const monthShortFormat = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });
const weekdayFormat = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" });

const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1);
const monthName = (m: number) => capitalize(monthFormat.format(new Date(Date.UTC(2000, m - 1, 1))));
const monthShort = (m: number) => monthShortFormat.format(new Date(Date.UTC(2000, m - 1, 1))).replace(".", "");
const weekdayOf = (date: string) => capitalize(weekdayFormat.format(new Date(`${date}T00:00:00Z`)));

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const dayCount = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

/**
 * One color per event (tokens in globals.css, light and dark). Literal classes for Tailwind.
 * bar: the strong tone on phones, where the bar is a thin line, and the tint with text on wider screens.
 */
const PALETTE = [
  {
    chip: "bg-[var(--cal-0-bg)] text-[var(--cal-0-fg)]",
    dot: "bg-[var(--cal-0-fg)]",
    bar: "bg-[var(--cal-0-fg)] text-[var(--cal-0-fg)] sm:bg-[var(--cal-0-bg)]",
  },
  {
    chip: "bg-[var(--cal-1-bg)] text-[var(--cal-1-fg)]",
    dot: "bg-[var(--cal-1-fg)]",
    bar: "bg-[var(--cal-1-fg)] text-[var(--cal-1-fg)] sm:bg-[var(--cal-1-bg)]",
  },
  {
    chip: "bg-[var(--cal-2-bg)] text-[var(--cal-2-fg)]",
    dot: "bg-[var(--cal-2-fg)]",
    bar: "bg-[var(--cal-2-fg)] text-[var(--cal-2-fg)] sm:bg-[var(--cal-2-bg)]",
  },
  {
    chip: "bg-[var(--cal-3-bg)] text-[var(--cal-3-fg)]",
    dot: "bg-[var(--cal-3-fg)]",
    bar: "bg-[var(--cal-3-fg)] text-[var(--cal-3-fg)] sm:bg-[var(--cal-3-bg)]",
  },
  {
    chip: "bg-[var(--cal-4-bg)] text-[var(--cal-4-fg)]",
    dot: "bg-[var(--cal-4-fg)]",
    bar: "bg-[var(--cal-4-fg)] text-[var(--cal-4-fg)] sm:bg-[var(--cal-4-bg)]",
  },
  {
    chip: "bg-[var(--cal-5-bg)] text-[var(--cal-5-fg)]",
    dot: "bg-[var(--cal-5-fg)]",
    bar: "bg-[var(--cal-5-fg)] text-[var(--cal-5-fg)] sm:bg-[var(--cal-5-bg)]",
  },
];

/** Deadlines keep the red outline; events take their own color from the palette. */
function tone(e: AgendaEntry, colors: Map<string, number>): { chip: string; dot: string; bar: string } {
  if (e.kind === "deadline") return { chip: "bg-card text-urgent ring-1 ring-inset ring-urgent/40", dot: "bg-urgent", bar: "bg-urgent" };
  return PALETTE[colors.get(e.key) ?? 0];
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line bg-card px-4 py-8 text-center text-[14px] text-muted">{children}</p>;
}

const iconButton =
  "grid size-9 place-items-center text-ink transition-colors hover:bg-ground focus-visible:relative focus-visible:z-10 disabled:opacity-40";

function Stepper({ onPrev, onNext, onToday, prevLabel, nextLabel }: { onPrev: () => void; onNext: () => void; onToday?: () => void; prevLabel: string; nextLabel: string }) {
  return (
    <div className="flex items-center divide-x divide-line overflow-hidden rounded-xl border border-line bg-card">
      <button type="button" aria-label={prevLabel} onClick={onPrev} className={iconButton}>
        <ChevronLeftIcon className="size-4.5" />
      </button>
      {onToday && (
        <button type="button" onClick={onToday} className="h-9 px-3 text-[13.5px] font-semibold transition-colors hover:bg-ground">
          Hoje
        </button>
      )}
      <button type="button" aria-label={nextLabel} onClick={onNext} className={iconButton}>
        <ChevronRightIcon className="size-4.5" />
      </button>
    </div>
  );
}

const shell = "overflow-hidden rounded-3xl border border-line bg-card shadow-[0_1px_2px_rgb(var(--shadow-rgb)/0.05),0_16px_40px_-24px_rgb(var(--shadow-rgb)/0.25)]";

/** One week of the month view: day numbers, bars for long events and chips for one-day ones. */
function WeekRow({
  week,
  entries,
  today,
  onOpenDay,
  actions,
  colors,
}: {
  week: CalendarDay[];
  entries: AgendaEntry[];
  today: string;
  onOpenDay: (date: string) => void;
  actions: CardActions;
  colors: Map<string, number>;
}) {
  const bars = weekBars(week, entries);
  const shownBars = bars.filter((b) => b.lane < MAX_LANES);
  const lanes = shownBars.length === 0 ? 0 : Math.max(...shownBars.map((b) => b.lane)) + 1;

  return (
    <div className="relative grid grid-cols-7 border-t border-line">
      {week.map((day, col) => {
        const active = activeOn(entries, day.date);
        const singles = active.filter((e) => e.endDate === e.date);
        const barsHere = shownBars.filter((b) => b.start <= col && col < b.start + b.span).length;
        const chips = singles.slice(0, MAX_CHIPS);
        const more = active.length - barsHere - chips.length;
        const weekend = col === 0 || col === 6;
        const past = day.date < today;
        return (
          <button
            key={day.date}
            type="button"
            onClick={() => onOpenDay(day.date)}
            aria-label={`${weekdayOf(day.date)}, ${longDate(day.date)}: ${active.length === 0 ? "nada marcado" : `${active.length} na agenda`}`}
            className={`group flex min-h-[68px] min-w-0 flex-col items-stretch border-l border-line p-1 text-left transition-colors first:border-l-0 hover:bg-sky/15 focus-visible:z-10 focus-visible:outline-offset-[-2px] sm:min-h-[118px] sm:p-1.5 ${
              !day.inMonth ? "bg-ground/70" : weekend ? "bg-ground/35" : ""
            }`}
          >
            <span
              className={`grid size-7 shrink-0 place-items-center self-start rounded-full text-[13px] font-bold tabular-nums transition-colors ${
                day.date === today
                  ? "bg-action text-card shadow-[0_2px_6px_rgb(var(--shadow-rgb)/0.3)]"
                  : !day.inMonth
                    ? "text-muted"
                    : past
                      ? "text-muted"
                      : "group-hover:bg-card"
              }`}
            >
              {Number(day.date.slice(8))}
            </span>
            {/* Room for the bars drawn over the week. */}
            <span aria-hidden="true" className="block shrink-0 sm:hidden" style={{ height: lanes * 9 }} />
            <span aria-hidden="true" className="hidden shrink-0 sm:block" style={{ height: lanes * 26 }} />
            {chips.length > 0 && (
              <span className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                {singles.slice(0, 3).map((e) => (
                  <span key={e.key} className={`size-2 rounded-full ${tone(e, colors).dot}`} />
                ))}
              </span>
            )}
            <span className="mt-1 hidden min-w-0 flex-col gap-0.5 sm:flex">
              {chips.map((e) => (
                <span key={e.key} className={`truncate rounded-md px-1.5 py-[3px] text-[12px] leading-tight font-semibold ${tone(e, colors).chip}`}>
                  {e.o.title}
                </span>
              ))}
              {more > 0 && <span className="px-1.5 text-[11.5px] font-semibold text-muted">+{more} mais</span>}
            </span>
          </button>
        );
      })}

      {/* Bars for events of several days, drawn across the cells they cover. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-[31px] grid grid-cols-7 gap-y-[3px] sm:top-[38px] sm:gap-y-1"
        style={{ gridTemplateRows: `repeat(${lanes}, auto)` }}
      >
        {shownBars.map((b) => (
          <button
            key={b.entry.key}
            type="button"
            tabIndex={-1}
            onClick={() => actions.onOpen(b.entry.o)}
            title={`${b.entry.o.title} · ${shortDate(b.entry.date)} a ${shortDate(b.entry.endDate)}`}
            style={{ gridColumn: `${b.start + 1} / span ${b.span}`, gridRow: b.lane + 1 }}
            className={`h-1.5 truncate text-left text-[12px] leading-[22px] font-semibold transition-[filter] hover:brightness-95 sm:pointer-events-auto sm:h-[22px] sm:px-1.5 ${tone(b.entry, colors).bar} ${
              b.continuesBefore ? "rounded-l-none" : "ml-1 rounded-l-md"
            } ${b.continuesAfter ? "rounded-r-none" : "mr-1 rounded-r-md"}`}
          >
            <span className="hidden sm:inline">
              {(b.continuesBefore || (b.entry.o.startsOn ?? b.entry.date) < b.entry.date) && "← "}
              {b.entry.o.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

const DAY_SECTIONS: { kind: AgendaEntry["kind"]; title: string }[] = [
  { kind: "event", title: "Acontecendo neste dia" },
  { kind: "deadline", title: "Inscrições que fecham" },
  { kind: "opens", title: "Programas que costumam abrir" },
];

/** The page of one day: every entry in full, with what it is. */
function DayPage({
  date,
  entries,
  today,
  profile,
  actions,
  onDate,
  onBack,
}: {
  date: string;
  entries: AgendaEntry[];
  today: string;
  profile: Profile | null;
  actions: CardActions;
  onDate: (date: string) => void;
  onBack: () => void;
}) {
  const all = activeOn(entries, date);
  const active = all.filter((e) => !isLongOnline(e));
  const longOnline = all.filter(isLongOnline);
  return (
    <div key={date} className="animate-[rise-in_.35s_cubic-bezier(.16,1,.3,1)]">
      <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1 rounded-lg py-1 pr-2 text-[14px] font-semibold text-action hover:underline">
        <ChevronLeftIcon className="size-4" />
        Voltar ao calendário
      </button>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold text-muted">{date === today ? "Hoje" : weekdayOf(date)}</p>
          <h3 className="text-[26px] leading-tight font-extrabold tracking-tight text-balance">{longDate(date)}</h3>
          <p className="mt-1 text-[14px] text-muted">
            {active.length === 0 ? "Nada marcado neste dia." : `${active.length} ${active.length === 1 ? "item" : "itens"} na sua agenda`}
          </p>
        </div>
        <Stepper prevLabel="Dia anterior" nextLabel="Próximo dia" onPrev={() => onDate(addDays(date, -1))} onNext={() => onDate(addDays(date, 1))} />
      </div>

      {active.length === 0 ? (
        <Empty>Nenhum evento, prazo ou abertura neste dia. Use as setas para ver os dias vizinhos.</Empty>
      ) : (
        DAY_SECTIONS.map(({ kind, title }) => {
          const list = active.filter((e) => e.kind === kind);
          if (list.length === 0) return null;
          return (
            <section key={kind} className="mb-8">
              <h4 className="mb-3 text-[17px] font-extrabold tracking-tight">
                {title} <span className="ml-1 text-[14px] font-semibold text-muted tabular-nums">{list.length}</span>
              </h4>
              <div className="grid gap-3">
                {list.map((e) => (
                  <OpportunityCard
                    key={e.key}
                    o={e.o}
                    today={today}
                    profile={profile}
                    actions={actions}
                    description={whatItIs(e.o)}
                    why={
                      e.endDate > e.date
                        ? `Dura ${dayCount(e.date, e.endDate)} dias, de ${shortDate(e.date)} a ${shortDate(e.endDate)}: este é o ${dayCount(e.date, date)}º dia.`
                        : e.distanceKm !== null
                          ? `A ${Math.max(1, Math.round(e.distanceKm))} km de você.`
                          : undefined
                    }
                  />
                ))}
              </div>
            </section>
          );
        })
      )}

      {longOnline.length > 0 && (
        <details className="group mt-2 rounded-2xl border border-line bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block text-[15px] font-extrabold tracking-tight">
                Hackathons online em andamento <span className="ml-1 text-[14px] font-semibold text-muted tabular-nums">{longOnline.length}</span>
              </span>
              <span className="block text-[13px] text-muted">Ficam abertos por semanas e não aparecem como barra no calendário. O prazo de cada um aparece no dia em que fecha.</span>
            </span>
            <ChevronRightIcon className="size-4.5 shrink-0 text-muted transition-transform group-open:rotate-90" />
          </summary>
          <ul className="border-t border-line">
            {longOnline.map((e) => (
              <AgendaRow key={e.key} entry={e} actions={actions} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** The Agenda tab: month calendar, whole-year overview, list, and the page of each day. */
export function AgendaCalendar({
  entries,
  today,
  profile,
  actions,
}: {
  entries: AgendaEntry[];
  today: string;
  profile: Profile | null;
  actions: CardActions;
}) {
  const [view, setView] = useState<View>("month");
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [day, setDay] = useState<string | null>(null);

  // What the grids draw: no months-long online events, and running events start today.
  const calendarEntries = useMemo(
    () => entries.filter((e) => !isLongOnline(e)).map((e) => (e.date < today ? { ...e, date: today } : e)),
    [entries, today],
  );

  const colors = useMemo(() => calendarColors(calendarEntries, PALETTE.length), [calendarEntries]);

  const countByMonth = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of calendarEntries) counts.set(e.date.slice(0, 7), (counts.get(e.date.slice(0, 7)) ?? 0) + 1);
    return counts;
  }, [calendarEntries]);
  const countIn = (y: number, m: number) => countByMonth.get(`${y}-${String(m).padStart(2, "0")}`) ?? 0;

  function goToMonth(y: number, m: number) {
    // Wraps around the year in both directions.
    const d = new Date(Date.UTC(y, m - 1, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth() + 1);
  }

  function openDay(date: string) {
    setDay(date);
    goToMonth(Number(date.slice(0, 4)), Number(date.slice(5, 7)));
  }

  if (day) {
    return <DayPage date={day} entries={entries} today={today} profile={profile} actions={actions} onDate={openDay} onBack={() => setDay(null)} />;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <h3 className="mr-auto text-[24px] leading-none font-extrabold tracking-tight">
          {view === "month" ? (
            <>
              {monthName(month)} <span className="font-semibold text-muted">{year}</span>
            </>
          ) : view === "year" ? (
            year
          ) : (
            "Próximas datas"
          )}
        </h3>
        {view === "month" && (
          <Stepper
            prevLabel="Mês anterior"
            nextLabel="Próximo mês"
            onPrev={() => goToMonth(year, month - 1)}
            onNext={() => goToMonth(year, month + 1)}
            onToday={() => goToMonth(Number(today.slice(0, 4)), Number(today.slice(5, 7)))}
          />
        )}
        {view === "year" && (
          <Stepper prevLabel="Ano anterior" nextLabel="Próximo ano" onPrev={() => setYear(year - 1)} onNext={() => setYear(year + 1)} onToday={() => setYear(Number(today.slice(0, 4)))} />
        )}
        <div className="flex rounded-xl bg-line/60 p-1" role="group" aria-label="Visão da agenda">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={view === v.id}
              onClick={() => setView(v.id)}
              className={`rounded-lg px-3.5 py-1.5 text-[13.5px] font-semibold transition-[background-color,box-shadow,color] ${
                view === v.id ? "bg-card text-ink shadow-[0_1px_3px_rgb(var(--shadow-rgb)/0.15)]" : "text-muted hover:text-ink"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {view === "list" &&
        (entries.length === 0 ? (
          <Empty>Nada com data marcada para este filtro agora.</Empty>
        ) : (
          groupAgenda(entries, today).map((g) => (
            <section key={g.id} className="mb-6">
              <h4 className="mb-2 text-[15px] font-extrabold tracking-tight">{g.label}</h4>
              <ul className={shell}>
                {g.entries.map((e) => (
                  <AgendaRow key={e.key} entry={e} actions={actions} />
                ))}
              </ul>
            </section>
          ))
        ))}

      {view === "month" && (
        <>
          <div className="-mx-4 mb-3 flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden" role="group" aria-label={`Meses de ${year}`}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const count = countIn(year, m);
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={m === month}
                  onClick={() => goToMonth(year, m)}
                  className={`flex shrink-0 items-baseline gap-1 rounded-lg px-2.5 py-1 text-[13px] font-semibold transition-colors ${
                    m === month ? "bg-ink text-card" : count > 0 ? "text-ink hover:bg-card" : "text-muted hover:bg-card"
                  }`}
                >
                  {monthShort(m)}
                  {count > 0 && <span className={`text-[11px] tabular-nums ${m === month ? "text-card/70" : "text-muted"}`}>{count}</span>}
                </button>
              );
            })}
          </div>

          <div className={shell}>
            <div className="grid grid-cols-7 bg-ground/60">
              {WEEKDAYS.map((d, i) => (
                <span key={d} className={`py-2 text-center text-[11.5px] font-bold tracking-wide text-muted uppercase ${i === 0 || i === 6 ? "text-muted" : ""}`}>
                  <span className="sm:hidden">{d[0]}</span>
                  <span className="hidden sm:inline">{d}</span>
                </span>
              ))}
            </div>
            {monthGrid(year, month).map((week) => (
              <WeekRow key={week[0].date} week={week} entries={calendarEntries} today={today} onOpenDay={openDay} actions={actions} colors={colors} />
            ))}
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="flex gap-0.5">
                {PALETTE.slice(0, 3).map((p) => (
                  <span key={p.dot} className={`h-2 w-3 rounded-sm ${p.dot}`} />
                ))}
              </span>
              cada evento tem sua cor
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-5 rounded-sm bg-card ring-1 ring-urgent/50" /> inscrições fecham
            </span>
            <span>Toque num dia para ver tudo o que tem nele.</span>
          </p>
        </>
      )}

      {view === "year" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <section key={m} className={`${shell} p-3`}>
              <button
                type="button"
                onClick={() => {
                  goToMonth(year, m);
                  setView("month");
                }}
                className="mb-2 flex w-full items-baseline justify-between text-left text-[14.5px] font-extrabold tracking-tight hover:text-action"
              >
                {monthName(m)}
                {countIn(year, m) > 0 && <span className="text-[12px] font-semibold text-muted tabular-nums">{countIn(year, m)}</span>}
              </button>
              <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] tabular-nums">
                {WEEKDAYS.map((d) => (
                  <span key={d} className="pb-0.5 font-bold text-muted">
                    {d[0]}
                  </span>
                ))}
                {monthGrid(year, m)
                  .flat()
                  .map((cell) => {
                    if (!cell.inMonth) return <span key={cell.date} />;
                    const active = activeOn(calendarEntries, cell.date);
                    return (
                      <button
                        key={cell.date}
                        type="button"
                        onClick={() => openDay(cell.date)}
                        aria-label={`${longDate(cell.date)}: ${active.length === 0 ? "nada marcado" : `${active.length} na agenda`}`}
                        className={`grid aspect-square place-items-center rounded-full transition-colors ${
                          cell.date === today
                            ? "bg-action font-bold text-card"
                            : active.length > 0
                              ? `${tone(active[0], colors).chip} font-bold`
                              : cell.date < today
                                ? "text-muted hover:bg-ground"
                                : "hover:bg-ground"
                        }`}
                      >
                        {Number(cell.date.slice(8))}
                      </button>
                    );
                  })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
