"use client";

import type { AgendaEntry } from "@/lib/agenda";
import type { Opportunity } from "@/lib/opportunity";
import { checksFor, type Check, type Profile } from "@/lib/personalize";
import {
  MODALITY_LABEL,
  TYPE_LABEL,
  TYPE_TONE,
  dateStub,
  initials,
  monthNames,
  placeLine,
  shortDate,
  topicTags,
  weekdayOf,
} from "./format";
import { ArrowIcon, BookmarkIcon, CheckIcon, QuestionIcon, XIcon } from "./icons";

export type CardActions = {
  onOpen: (o: Opportunity) => void;
  onToggleSave: (o: Opportunity) => void;
  isSaved: (o: Opportunity) => boolean;
};

export function Avatar({ o, size = "lg" }: { o: Opportunity; size?: "lg" | "sm" }) {
  const tone = TYPE_TONE[o.type];
  return (
    <span
      aria-hidden="true"
      className={`${tone.bg} ${tone.text} grid shrink-0 place-items-center font-extrabold tracking-tight ${
        size === "lg" ? "size-12 rounded-xl text-base sm:size-14 sm:text-lg" : "size-10 rounded-[10px] text-[13px]"
      }`}
    >
      {initials(o)}
    </span>
  );
}

export function TypeTag({ o }: { o: Opportunity }) {
  const tone = TYPE_TONE[o.type];
  return (
    <span className={`${tone.bg} ${tone.text} rounded-md px-2 py-0.5 text-[11.5px] font-bold tracking-wide uppercase`}>
      {TYPE_LABEL[o.type]}
    </span>
  );
}

export function ModeTag({ o, onNavy = false }: { o: Opportunity; onNavy?: boolean }) {
  const solid = o.modality !== "online";
  const cls = onNavy
    ? solid
      ? "border-white bg-white text-navy"
      : "border-white text-white"
    : solid
      ? "border-ink bg-ink text-white"
      : "border-ink text-ink";
  return (
    <span className={`${cls} rounded-md border-[1.5px] px-2 py-px text-[11.5px] font-bold tracking-wide uppercase`}>
      {MODALITY_LABEL[o.modality]}
    </span>
  );
}

export function CheckList({ checks, size = "sm" }: { checks: Check[]; size?: "sm" | "md" }) {
  if (checks.length === 0) return null;
  return (
    <ul className={size === "sm" ? "flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] font-semibold" : "grid gap-1.5 text-[14.5px]"}>
      {checks.map((c) => (
        <li
          key={c.label}
          className={`flex items-center gap-1.5 ${c.ok === true ? "text-open" : c.ok === false ? "text-urgent" : "text-muted font-medium"}`}
        >
          {c.ok === true ? (
            <CheckIcon className="size-3.5 shrink-0" />
          ) : c.ok === false ? (
            <XIcon className="size-3.5 shrink-0" />
          ) : (
            <QuestionIcon className="size-3.5 shrink-0" />
          )}
          {c.label}
        </li>
      ))}
    </ul>
  );
}

function SaveButton({ o, actions }: { o: Opportunity; actions: CardActions }) {
  const saved = actions.isSaved(o);
  return (
    <button
      type="button"
      onClick={() => actions.onToggleSave(o)}
      aria-pressed={saved}
      aria-label={saved ? `Remover ${o.title} dos salvos` : `Salvar ${o.title}`}
      className={`relative z-10 grid size-9 place-items-center rounded-lg border transition-colors ${
        saved ? "border-action bg-action text-white" : "border-line text-muted hover:border-ink hover:text-ink"
      }`}
    >
      <BookmarkIcon filled={saved} className="size-4" />
    </button>
  );
}

export function OpportunityCard({
  o,
  today,
  profile,
  actions,
  why,
  description,
}: {
  o: Opportunity;
  today: string | null;
  profile: Profile | null;
  actions: CardActions;
  why?: string;
  /** What this kind of opportunity is, shown on the Agenda's day page. */
  description?: string;
}) {
  const stub = dateStub(o, today);
  const topics = topicTags(o).slice(0, 3);

  return (
    <article className="group relative grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-3 rounded-2xl border border-line bg-card p-4 transition-[box-shadow,transform] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(12,42,102,0.10)] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-4">
      <Avatar o={o} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <TypeTag o={o} />
          <ModeTag o={o} />
          <span className="text-sm font-bold">{placeLine(o)}</span>
        </div>
        <h3 className="mt-1.5 text-lg leading-snug font-bold tracking-tight">
          <button
            type="button"
            onClick={() => actions.onOpen(o)}
            className="text-left after:absolute after:inset-0 after:rounded-2xl after:content-[''] group-hover:underline group-hover:underline-offset-4 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-action"
          >
            {o.title}
          </button>
        </h3>
        {o.organizer && <p className="mt-0.5 text-[13.5px] text-muted">{o.organizer}</p>}
        {description && <p className="mt-2 max-w-[65ch] text-[14px] leading-relaxed">{description}</p>}
        {o.benefits.length > 0 && (
          <p className="mt-2 inline-flex rounded-md bg-prize-bg px-2 py-1 text-[13.5px] font-bold text-prize">
            {o.benefits.join(" · ")}
          </p>
        )}
        {topics.length > 0 && <p className="mt-2 text-[12.5px] text-muted">{topics.join(" · ")}</p>}
        <div className="mt-2.5">
          <CheckList checks={checksFor(o, profile, today ?? "1970-01-01")} />
        </div>
        {why && <p className="mt-2 text-[12.5px] text-muted">{why}</p>}
      </div>

      <div className="col-span-2 flex items-center justify-between gap-3 border-t border-dashed border-line pt-3 sm:col-span-1 sm:flex-col sm:items-end sm:justify-between sm:border-0 sm:pt-0 sm:text-right">
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">{stub.label}</p>
          <p className="text-[22px] leading-none font-extrabold tracking-tight sm:text-[26px]">{stub.date}</p>
          {stub.hint && (
            <p
              className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[12.5px] font-bold ${
                stub.urgent ? "bg-urgent-bg text-urgent" : "bg-ground text-muted"
              }`}
            >
              {stub.hint}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <SaveButton o={o} actions={actions} />
          <a
            href={o.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-10 inline-flex items-center gap-1.5 rounded-[9px] bg-action px-3 py-2 text-[13px] font-bold whitespace-nowrap text-white hover:bg-navy"
          >
            Página oficial
            <ArrowIcon className="size-3.5" />
          </a>
        </div>
      </div>
    </article>
  );
}

export function CompactRow({ o, today, actions }: { o: Opportunity; today: string | null; actions: CardActions }) {
  const stub = dateStub(o, today);
  return (
    <li className="group relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-line px-3.5 py-3 first:border-t-0 hover:bg-ground/60">
      <Avatar o={o} size="sm" />
      <div className="min-w-0">
        <button
          type="button"
          onClick={() => actions.onOpen(o)}
          className="block max-w-full truncate text-left text-[15px] font-bold after:absolute after:inset-0 after:content-[''] group-hover:underline group-hover:underline-offset-4 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-action"
        >
          {o.title}
        </button>
        <p className="truncate text-[12.5px] text-muted">
          {[o.organizer, o.benefits[0]].filter(Boolean).join(" · ") || TYPE_LABEL[o.type]}
        </p>
      </div>
      <div className="text-right">
        <p className="text-[15px] font-extrabold">{stub.date}</p>
        {stub.hint && <p className={`text-[12px] font-semibold ${stub.urgent ? "text-urgent" : "text-muted"}`}>{stub.hint}</p>}
      </div>
    </li>
  );
}

const AGENDA_KIND_LABEL: Record<AgendaEntry["kind"], string | null> = {
  event: null,
  deadline: "Inscrições fecham",
  opens: "Costuma abrir",
};

/** One line of the Agenda tab: the date, what happens that day and where. */
export function AgendaRow({ entry, actions }: { entry: AgendaEntry; actions: CardActions }) {
  const { o, kind, date, distanceKm } = entry;
  const where =
    kind === "opens"
      ? null
      : o.modality === "online"
        ? "Online"
        : distanceKm !== null
          ? `${placeLine(o)} · a ${Math.max(1, Math.round(distanceKm))} km`
          : placeLine(o);
  return (
    <li className="group relative grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 border-t border-line px-3.5 py-3 first:border-t-0 hover:bg-ground/60">
      <span className={`rounded-lg py-1.5 text-center ${kind === "deadline" ? "bg-urgent-bg text-urgent" : "bg-ground"}`}>
        <span className="block text-[15px] font-extrabold tabular-nums">
          {kind === "opens" ? monthNames([Number(date.slice(5, 7))]).slice(0, 3) : shortDate(date)}
        </span>
        <span className="block text-[11px] font-semibold text-muted">{kind === "opens" ? "mês" : weekdayOf(date).slice(0, 3)}</span>
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <TypeTag o={o} />
          {AGENDA_KIND_LABEL[kind] && <span className="text-[12.5px] font-bold">{AGENDA_KIND_LABEL[kind]}</span>}
        </div>
        <button
          type="button"
          onClick={() => actions.onOpen(o)}
          className="mt-1 block max-w-full truncate text-left text-[15px] font-bold after:absolute after:inset-0 after:content-[''] group-hover:underline group-hover:underline-offset-4 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-action"
        >
          {o.title}
        </button>
        {where && <p className="truncate text-[12.5px] text-muted">{where}</p>}
      </div>
      <SaveButton o={o} actions={actions} />
    </li>
  );
}

export function ProgramCard({ o, actions }: { o: Opportunity; actions: CardActions }) {
  const stub = dateStub(o, null);
  const isOpen = o.status === "open";
  return (
    <article className="group relative flex flex-col rounded-2xl border border-line bg-card p-4">
      <p className={`text-[12.5px] font-bold ${isOpen ? "text-open" : "text-prog"}`}>
        {isOpen ? "Inscrições abertas" : stub.label === "Costuma abrir" ? `Fechado · costuma abrir em ${stub.date}` : "Fechado no momento"}
      </p>
      <h3 className="mt-1.5 text-base leading-snug font-bold tracking-tight">
        <button
          type="button"
          onClick={() => actions.onOpen(o)}
          className="text-left after:absolute after:inset-0 after:rounded-2xl after:content-[''] group-hover:underline group-hover:underline-offset-4 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-action"
        >
          {o.title}
        </button>
      </h3>
      <p className="mt-0.5 text-[13px] text-muted">{o.organizer}</p>
      {o.benefits.length > 0 && <p className="mt-2 text-[13px]">{o.benefits.join(" · ")}</p>}
      {o.note && <p className="mt-2 text-[12px] text-muted">{o.note}</p>}
    </article>
  );
}
