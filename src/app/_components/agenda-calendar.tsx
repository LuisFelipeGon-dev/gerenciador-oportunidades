"use client";

import { useMemo, useState } from "react";
import { entriesByDay, groupAgenda, monthGrid, type AgendaEntry } from "@/lib/agenda";
import { AgendaRow, type CardActions } from "./cards";
import { TYPE_TONE, longDate } from "./format";

type View = "month" | "year" | "list";

const VIEWS: { id: View; label: string }[] = [
  { id: "month", label: "Mês" },
  { id: "year", label: "Ano" },
  { id: "list", label: "Lista" },
];

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const monthFormat = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });
const monthShortFormat = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });

function monthName(month: number): string {
  const name = monthFormat.format(new Date(Date.UTC(2000, month - 1, 1)));
  return name[0].toUpperCase() + name.slice(1);
}
const monthShort = (month: number) => monthShortFormat.format(new Date(Date.UTC(2000, month - 1, 1))).replace(".", "");

/** Chip and dot colors: deadlines in red, otherwise the color of the opportunity type. */
function tone(e: AgendaEntry): { chip: string; dot: string } {
  if (e.kind === "deadline") return { chip: "bg-urgent-bg text-urgent", dot: "bg-urgent" };
  const t = TYPE_TONE[e.o.type];
  return { chip: `${t.bg} ${t.text}`, dot: t.bar };
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line bg-card px-4 py-6 text-center text-[14px] text-muted">{children}</p>;
}

function EntryList({ entries, actions }: { entries: AgendaEntry[]; actions: CardActions }) {
  return (
    <ul className="overflow-hidden rounded-2xl border border-line bg-card">
      {entries.map((e) => (
        <AgendaRow key={e.key} entry={e} actions={actions} />
      ))}
    </ul>
  );
}

function NavButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-lg border border-line bg-card text-[18px] font-bold hover:border-ink"
    >
      {children}
    </button>
  );
}

/** The Agenda tab: a month calendar, a whole-year overview and the plain list. */
export function AgendaCalendar({ entries, today, actions }: { entries: AgendaEntry[]; today: string; actions: CardActions }) {
  const [view, setView] = useState<View>("month");
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [selected, setSelected] = useState(today);
  const byDay = useMemo(() => entriesByDay(entries), [entries]);

  function goToMonth(y: number, m: number) {
    // Month arithmetic that wraps around the year.
    const d = new Date(Date.UTC(y, m - 1, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth() + 1);
  }

  function openDay(date: string) {
    setSelected(date);
    goToMonth(Number(date.slice(0, 4)), Number(date.slice(5, 7)));
    setView("month");
  }

  const countInMonth = (y: number, m: number) => {
    const prefix = `${y}-${String(m).padStart(2, "0")}`;
    return entries.filter((e) => e.date.startsWith(prefix)).length;
  };

  return (
    <div>
      <div className="mb-4 inline-flex rounded-lg border border-line bg-card p-0.5" role="group" aria-label="Visão da agenda">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={view === v.id}
            onClick={() => setView(v.id)}
            className={`rounded-md px-3.5 py-1.5 text-[13.5px] font-semibold ${view === v.id ? "bg-ink text-white" : "hover:bg-ground"}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === "list" &&
        (entries.length === 0 ? (
          <Empty>Nada com data marcada para este filtro agora.</Empty>
        ) : (
          groupAgenda(entries, today).map((g) => (
            <section key={g.id} className="mb-6">
              <h3 className="mb-2 text-[12.5px] font-bold tracking-wider text-muted uppercase">{g.label}</h3>
              <EntryList entries={g.entries} actions={actions} />
            </section>
          ))
        ))}

      {view === "month" && (
        <>
          <div className="mb-3 flex items-center gap-2">
            <NavButton label="Mês anterior" onClick={() => goToMonth(year, month - 1)}>
              ‹
            </NavButton>
            <h3 className="min-w-0 flex-1 text-center text-[17px] font-extrabold tracking-tight">
              {monthName(month)} de {year}
            </h3>
            <NavButton label="Próximo mês" onClick={() => goToMonth(year, month + 1)}>
              ›
            </NavButton>
            <button
              type="button"
              onClick={() => openDay(today)}
              className="rounded-lg border border-line bg-card px-3 py-1.5 text-[13.5px] font-semibold hover:border-ink"
            >
              Hoje
            </button>
          </div>

          <div className="-mx-4 mb-3 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label={`Meses de ${year}`}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const count = countInMonth(year, m);
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={m === month}
                  onClick={() => goToMonth(year, m)}
                  className={`shrink-0 rounded-full px-3 py-1 text-[13px] font-semibold ${
                    m === month ? "bg-ink text-white" : count > 0 ? "bg-ground hover:bg-line" : "text-muted hover:bg-ground"
                  }`}
                >
                  {monthShort(m)}
                  {count > 0 && <span className="ml-1 tabular-nums opacity-70">{count}</span>}
                </button>
              );
            })}
          </div>

          <div className="overflow-hidden rounded-2xl border border-line bg-card">
            <div className="grid grid-cols-7 border-b border-line bg-ground text-center text-[12px] font-bold text-muted">
              {WEEKDAYS.map((d, i) => (
                <span key={i} className="py-1.5">
                  {d}
                </span>
              ))}
            </div>
            {monthGrid(year, month).map((week) => (
              <div key={week[0].date} className="grid grid-cols-7 border-b border-line last:border-b-0">
                {week.map((day) => {
                  const dayEntries = byDay.get(day.date) ?? [];
                  const past = day.date < today;
                  return (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => setSelected(day.date)}
                      aria-pressed={selected === day.date}
                      aria-label={`${longDate(day.date)}: ${dayEntries.length === 0 ? "nada marcado" : `${dayEntries.length} na agenda`}`}
                      className={`flex min-h-14 min-w-0 flex-col items-stretch gap-1 border-r border-line p-1 text-left last:border-r-0 sm:min-h-24 sm:p-1.5 ${
                        selected === day.date ? "bg-sky/25" : "hover:bg-ground/70"
                      } ${day.inMonth ? "" : "bg-ground/50"}`}
                    >
                      <span
                        className={`grid size-6 place-items-center self-start rounded-full text-[12.5px] font-bold tabular-nums ${
                          day.date === today ? "bg-action text-white" : !day.inMonth || past ? "text-muted/60" : ""
                        }`}
                      >
                        {Number(day.date.slice(8))}
                      </span>
                      {/* Phones: colored dots. Wider screens: the first titles. */}
                      {dayEntries.length > 0 && (
                        <span className="flex flex-wrap gap-0.5 sm:hidden">
                          {dayEntries.slice(0, 3).map((e) => (
                            <span key={e.key} className={`size-1.5 rounded-full ${tone(e).dot}`} />
                          ))}
                        </span>
                      )}
                      <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                        {dayEntries.slice(0, 2).map((e) => (
                          <span key={e.key} className={`truncate rounded px-1 py-px text-[11px] leading-tight font-semibold ${tone(e).chip}`}>
                            {e.o.title}
                          </span>
                        ))}
                        {dayEntries.length > 2 && <span className="px-1 text-[11px] font-semibold text-muted">+{dayEntries.length - 2}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <section className="mt-5" aria-live="polite">
            <h3 className="mb-2 text-[12.5px] font-bold tracking-wider text-muted uppercase">
              {selected === today ? `Hoje, ${longDate(selected)}` : longDate(selected)}
            </h3>
            {(byDay.get(selected) ?? []).length === 0 ? (
              <Empty>Nada marcado neste dia. Os dias com pontos ou etiquetas têm eventos ou prazos.</Empty>
            ) : (
              <EntryList entries={byDay.get(selected)!} actions={actions} />
            )}
          </section>
        </>
      )}

      {view === "year" && (
        <>
          <div className="mb-3 flex items-center gap-2">
            <NavButton label="Ano anterior" onClick={() => setYear(year - 1)}>
              ‹
            </NavButton>
            <h3 className="flex-1 text-center text-[17px] font-extrabold tracking-tight">{year}</h3>
            <NavButton label="Próximo ano" onClick={() => setYear(year + 1)}>
              ›
            </NavButton>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <section key={m} className="rounded-2xl border border-line bg-card p-2.5">
                <button
                  type="button"
                  onClick={() => {
                    goToMonth(year, m);
                    setView("month");
                  }}
                  className="mb-1.5 flex w-full items-baseline justify-between text-left text-[14px] font-extrabold hover:underline"
                >
                  {monthName(m)}
                  {countInMonth(year, m) > 0 && <span className="text-[12px] font-semibold text-muted tabular-nums">{countInMonth(year, m)}</span>}
                </button>
                <div className="grid grid-cols-7 gap-px text-center text-[10.5px] tabular-nums">
                  {WEEKDAYS.map((d, i) => (
                    <span key={i} className="font-bold text-muted">
                      {d}
                    </span>
                  ))}
                  {monthGrid(year, m)
                    .flat()
                    .map((day) =>
                      day.inMonth ? (
                        <button
                          key={day.date}
                          type="button"
                          onClick={() => openDay(day.date)}
                          aria-label={longDate(day.date)}
                          className={`aspect-square rounded ${
                            day.date === today
                              ? "bg-action font-bold text-white"
                              : byDay.has(day.date)
                                ? `${tone(byDay.get(day.date)![0]).chip} font-bold`
                                : day.date < today
                                  ? "text-muted/50"
                                  : "hover:bg-ground"
                          }`}
                        >
                          {Number(day.date.slice(8))}
                        </button>
                      ) : (
                        <span key={day.date} />
                      ),
                    )}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
