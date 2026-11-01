"use client";

import type { AgendaEntry } from "@/lib/agenda";
import type { Opportunity } from "@/lib/opportunity";
import { checksFor, keyDate, type Check, type Profile } from "@/lib/personalize";
import { MODALITY_LABEL, TYPE_LABEL, TYPE_TONE, dateStub, monthNames, placeLine, topicTags, weekdayOf } from "./format";
import { ArrowIcon, BookmarkIcon, CheckIcon, QuestionIcon, XIcon } from "./icons";

export type CardActions = {
  onOpen: (o: Opportunity) => void;
  onToggleSave: (o: Opportunity) => void;
  isSaved: (o: Opportunity) => boolean;
};

const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** What the date column shows: a day and month, or the program's state when there is no date. */
function datePart(o: Opportunity, today: string | null) {
  const stub = dateStub(o, today);
  const date = keyDate(o);
  if (date && !(o.source === "curated" && !o.registrationDeadline)) {
    return { top: MONTH_ABBR[Number(date.slice(5, 7)) - 1], big: date.slice(8, 10), hint: stub.hint, urgent: stub.urgent, label: stub.label };
  }
  if (o.status === "open") return { top: "inscrições", big: "abertas", hint: null, urgent: false, label: "Inscrições" };
  if (o.typicalOpenMonths.length > 0) {
    const now = today ? Number(today.slice(5, 7)) : 1;
    const months = [...o.typicalOpenMonths].sort((a, b) => a - b);
    const next = months.find((m) => m >= now) ?? months[0];
    return { top: "abre em", big: MONTH_ABBR[next - 1], hint: "todo ano", urgent: false, label: "Costuma abrir" };
  }
  return { top: "inscrições", big: "fechadas", hint: null, urgent: false, label: "Inscrições" };
}

function DateColumn({ o, today }: { o: Opportunity; today: string | null }) {
  const d = datePart(o, today);
  const word = d.big.length > 3;
  return (
    <div
      className={`flex w-full shrink-0 flex-row items-baseline gap-2.5 border-b px-4 py-2.5 text-center sm:w-[96px] sm:flex-col sm:items-center sm:justify-center sm:gap-0 sm:border-r sm:border-b-0 sm:px-2 sm:py-4 ${
        d.urgent
          ? "border-[color-mix(in_srgb,var(--urgent)_28%,var(--line))] bg-urgent-bg text-urgent"
          : "border-[color-mix(in_srgb,var(--action)_22%,var(--line))] bg-sky-tint text-action"
      }`}
    >
      <span className="sr-only">{d.label}:</span>
      <span
        className={`order-2 font-mono leading-none font-semibold tracking-[-0.05em] sm:order-none ${word ? "text-[17px] sm:text-[18px] sm:leading-6" : "text-[22px] sm:text-[32px] sm:leading-[38px]"}`}
      >
        {d.big}
      </span>
      <span className="order-1 font-mono text-[12.5px] font-semibold sm:order-first">{d.top}</span>
      {d.hint && (
        <span className="order-3 ml-auto font-mono text-[11.5px] leading-[15px] font-semibold sm:mt-1 sm:ml-0">{d.hint}</span>
      )}
    </div>
  );
}

export function TypeTag({ o }: { o: Opportunity }) {
  const tone = TYPE_TONE[o.type];
  return (
    <span className={`${tone.bg} ${tone.text} rounded-sm px-1.5 py-px font-mono text-[11px] font-semibold tracking-tight uppercase`}>
      {TYPE_LABEL[o.type]}
    </span>
  );
}

export function ModeTag({ o }: { o: Opportunity }) {
  const solid = o.modality !== "online";
  return (
    <span
      className={`rounded-sm border px-1.5 py-px font-mono text-[11px] font-semibold tracking-tight uppercase ${
        solid ? "border-ink bg-ink text-ground" : "border-line-strong text-ink"
      }`}
    >
      {MODALITY_LABEL[o.modality]}
    </span>
  );
}

/** Type · modality · place, in the small monospaced line above the title. */
function Kicker({ o }: { o: Opportunity }) {
  const parts = [MODALITY_LABEL[o.modality], ...(o.modality === "online" ? [] : [placeLine(o)])];
  return (
    <p className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 font-mono text-[11.5px] leading-5 font-semibold tracking-tight text-muted">
      <span className={TYPE_TONE[o.type].text}>{TYPE_LABEL[o.type]}</span>
      {parts.map((p) => (
        <span key={p} className="flex items-center gap-2.5">
          <span aria-hidden="true" className="size-[3px] shrink-0 rounded-full bg-line-strong" />
          {p}
        </span>
      ))}
    </p>
  );
}

function fitOf(checks: Check[]): "ok" | "no" | "unk" {
  if (checks.some((c) => c.ok === false)) return "no";
  if (checks.some((c) => c.ok === null)) return "unk";
  return "ok";
}

const FIT = {
  ok: { label: "Combina com você", color: "var(--open)" },
  no: { label: "Falta um requisito", color: "var(--urgent)" },
  unk: { label: "Confirme os requisitos", color: "var(--action)" },
};

/** The verdict of "Posso participar?" as one bar; only shown when there is a profile to check against. */
export function FitBadge({ checks }: { checks: Check[] }) {
  const f = FIT[fitOf(checks)];
  return (
    <span
      style={{ "--fc": f.color } as React.CSSProperties}
      className="inline-flex w-fit max-w-full items-center gap-2 rounded-sm border border-l-2 border-[color-mix(in_srgb,var(--fc)_38%,var(--line))] border-l-[var(--fc)] bg-[color-mix(in_srgb,var(--fc)_15%,var(--card))] py-0.5 pr-2.5 pl-2 font-mono text-[12px] leading-[17px] font-semibold tracking-tight text-ink"
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-[1px] bg-[var(--fc)]" />
      {f.label}
    </span>
  );
}

export function CheckList({ checks, size = "sm" }: { checks: Check[]; size?: "sm" | "md" }) {
  if (checks.length === 0) return null;
  return (
    <ul className={size === "sm" ? "flex flex-wrap gap-x-4 gap-y-1 text-[13px] leading-5" : "grid gap-2 text-[14.5px] leading-[22px]"}>
      {checks.map((c) => (
        <li key={c.label} className={`flex items-start gap-1.5 ${c.ok === null ? "text-muted" : "font-medium text-ink-2"}`}>
          {c.ok === true ? (
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-open" />
          ) : c.ok === false ? (
            <XIcon className="mt-0.5 size-4 shrink-0 text-urgent" />
          ) : (
            <QuestionIcon className="mt-0.5 size-4 shrink-0" />
          )}
          {c.label}
        </li>
      ))}
    </ul>
  );
}

export function PrizeBar({ text }: { text: string }) {
  return (
    <p className="block w-fit max-w-full rounded-sm border border-l-2 border-[color-mix(in_srgb,var(--action)_32%,var(--line))] border-l-action bg-[color-mix(in_srgb,var(--action)_14%,var(--card-2))] py-0.5 pr-3 pl-2.5 text-[12.5px] leading-[18px] font-semibold text-ink">
      {text}
    </p>
  );
}

export function SaveButton({ o, actions, compact = false }: { o: Opportunity; actions: CardActions; compact?: boolean }) {
  const saved = actions.isSaved(o);
  return (
    <button
      type="button"
      onClick={() => actions.onToggleSave(o)}
      aria-pressed={saved}
      aria-label={saved ? `Remover ${o.title} dos salvos` : `Salvar ${o.title}`}
      className={`relative z-10 inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-md border font-mono text-[12.5px] font-semibold tracking-tight transition-[border-color,background-color,color] ${
        compact ? "w-10 border-transparent" : "px-3.5"
      } ${
        saved
          ? `${compact ? "" : "border-action bg-sky-tint"} text-ink`
          : "border-line-strong text-ink-2 hover:border-action hover:bg-sky-tint hover:text-ink"
      }`}
    >
      <BookmarkIcon filled={saved} className={`size-[18px] ${saved ? "animate-[pop_.32s_cubic-bezier(.2,.8,.2,1)] text-action" : ""}`} />
      {!compact && (saved ? "Salvo" : "Salvar")}
    </button>
  );
}

export function OfficialLink({ o, className = "" }: { o: Opportunity; className?: string }) {
  return (
    <a
      href={o.officialUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`group/go relative z-10 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-btn px-4 font-mono text-[13px] font-semibold tracking-tight whitespace-nowrap text-on-btn transition-[background-color,box-shadow,transform] hover:bg-btn-hover hover:shadow-[0_6px_22px_-10px_var(--btn)] active:scale-[.98] ${className}`}
    >
      Página oficial
      <ArrowIcon className="size-4 transition-transform duration-200 group-hover/go:translate-x-[3px]" />
    </a>
  );
}

/** The main card: date column, what and where, the prize, "Posso participar?" and the two actions. */
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
  const topics = topicTags(o).slice(0, 3);
  const checks = checksFor(o, profile, today ?? "1970-01-01");

  return (
    <article className="group grid-bg spot flex flex-wrap items-stretch bg-card transition-[box-shadow] hover:shadow-[inset_0_0_0_1px_var(--action)] focus-within:shadow-[inset_0_0_0_1px_var(--action)]">
      <DateColumn o={o} today={today} />
      <div className="min-w-0 flex-[1_1_260px] p-4 sm:px-5 sm:py-[18px]">
        <Kicker o={o} />
        <h3 className="mt-1 font-mono text-[16.5px] leading-[23px] font-semibold tracking-[-0.045em] text-balance [overflow-wrap:anywhere] sm:text-[18px] sm:leading-[25px]">
          <button
            type="button"
            onClick={() => actions.onOpen(o)}
            className="text-left decoration-action underline-offset-[5px] group-hover:underline after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-action"
          >
            {o.title}
          </button>
        </h3>
        {o.organizer && <p className="mt-0.5 text-[13.5px] leading-5 text-muted">{o.organizer}</p>}
        {(description ?? o.summary) && <p className="mt-2 max-w-[65ch] text-[14px] leading-relaxed text-ink-2">{description ?? o.summary}</p>}
        {o.benefits.length > 0 && (
          <div className="mt-3">
            <PrizeBar text={o.benefits.join(" · ")} />
          </div>
        )}
        {topics.length > 0 && <p className="mt-2 font-mono text-[12px] tracking-tight text-muted">{topics.join(" · ")}</p>}
        {o.note && <p className="mt-2 text-[12.5px] text-muted">{o.note}</p>}
        <div className="mt-3.5 flex flex-col gap-2 border-t border-line pt-3.5">
          {profile && <FitBadge checks={checks} />}
          <CheckList checks={checks} />
        </div>
        {why && <p className="mt-2 font-mono text-[12px] tracking-tight text-muted">{why}</p>}
      </div>
      <div className="flex w-full items-center gap-2 px-4 pb-4 sm:ml-auto sm:w-auto sm:py-[18px] sm:pr-5 sm:pl-0">
        <SaveButton o={o} actions={actions} />
        <OfficialLink o={o} className="flex-1 sm:flex-none" />
      </div>
    </article>
  );
}

/** A short date block for rows: day over month, red when the deadline is close. */
function WhenBlock({ date, urgent, sub }: { date: string | null; urgent: boolean; sub?: string }) {
  return (
    <span
      className={`flex w-14 shrink-0 flex-col items-center justify-center self-stretch border-r py-3 text-center font-mono text-[11.5px] leading-4 font-semibold sm:w-16 ${
        urgent
          ? "border-[color-mix(in_srgb,var(--urgent)_28%,var(--line))] bg-urgent-bg text-urgent"
          : "border-[color-mix(in_srgb,var(--action)_22%,var(--line))] bg-sky-tint text-action"
      }`}
    >
      {date ? (
        <>
          <b className="block text-[20px] leading-[22px] font-semibold tracking-[-0.04em]">{date.slice(8, 10)}</b>
          {sub ?? MONTH_ABBR[Number(date.slice(5, 7)) - 1]}
        </>
      ) : (
        <b className="text-[11.5px] leading-4 font-semibold">{sub ?? "—"}</b>
      )}
    </span>
  );
}

export function CompactRow({ o, today, actions }: { o: Opportunity; today: string | null; actions: CardActions }) {
  const stub = dateStub(o, today);
  const date = o.source === "curated" && !o.registrationDeadline ? null : keyDate(o);
  return (
    <li className="group relative flex items-stretch gap-3.5 border-t border-line pr-3 first:border-t-0 sm:pr-4">
      <WhenBlock date={date} urgent={stub.urgent} sub={date ? undefined : o.status === "open" ? "aberto" : "fechado"} />
      <div className="min-w-0 flex-1 self-center py-2.5">
        <button
          type="button"
          onClick={() => actions.onOpen(o)}
          className="block max-w-full truncate text-left font-mono text-[13.5px] leading-[22px] font-semibold tracking-[-0.03em] decoration-action underline-offset-4 group-hover:underline after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-action"
        >
          {o.title}
        </button>
        <p className="truncate text-[12.5px] leading-[18px] text-muted">
          {[TYPE_LABEL[o.type], o.organizer, o.benefits[0]].filter(Boolean).join(" · ")}
        </p>
      </div>
      {stub.hint && (
        <span className={`hidden shrink-0 self-center font-mono text-[12px] font-semibold sm:block ${stub.urgent ? "text-urgent" : "text-muted"}`}>
          {stub.hint}
        </span>
      )}
      <span className="self-center">
        <SaveButton o={o} actions={actions} compact />
      </span>
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
    <li className="group relative flex items-stretch gap-3.5 border-t border-line pr-3 first:border-t-0 sm:pr-4">
      {kind === "opens" ? (
        <WhenBlock date={null} urgent={false} sub={monthNames([Number(date.slice(5, 7))]).slice(0, 3)} />
      ) : (
        <WhenBlock date={date} urgent={kind === "deadline"} sub={weekdayOf(date).slice(0, 3)} />
      )}
      <div className="min-w-0 flex-1 self-center py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <TypeTag o={o} />
          {AGENDA_KIND_LABEL[kind] && <span className="font-mono text-[12px] font-semibold tracking-tight">{AGENDA_KIND_LABEL[kind]}</span>}
        </div>
        <button
          type="button"
          onClick={() => actions.onOpen(o)}
          className="mt-1 block max-w-full truncate text-left font-mono text-[13.5px] leading-[22px] font-semibold tracking-[-0.03em] decoration-action underline-offset-4 group-hover:underline after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-action"
        >
          {o.title}
        </button>
        {where && <p className="truncate text-[12.5px] text-muted">{where}</p>}
      </div>
      <span className="self-center">
        <SaveButton o={o} actions={actions} compact />
      </span>
    </li>
  );
}

export function ProgramCard({ o, today, actions }: { o: Opportunity; today?: string | null; actions: CardActions }) {
  const stub = dateStub(o, null);
  const isOpen = o.status === "open";
  return (
    <article className="group grid-bg spot flex flex-wrap items-stretch bg-card transition-[box-shadow] hover:shadow-[inset_0_0_0_1px_var(--action)] focus-within:shadow-[inset_0_0_0_1px_var(--action)]">
      <DateColumn o={o} today={today ?? null} />
      <div className="min-w-0 flex-[1_1_200px] p-4 sm:px-5 sm:py-[18px]">
        <p className={`font-mono text-[12px] leading-[18px] font-semibold tracking-tight ${isOpen ? "text-open" : "text-muted"}`}>
          {isOpen ? "Inscrições abertas" : stub.label === "Costuma abrir" ? `Fechado · costuma abrir em ${stub.date}` : "Fechado no momento"}
        </p>
        <h3 className="mt-1.5 font-mono text-[15.5px] leading-[22px] font-semibold tracking-[-0.045em]">
          <button
            type="button"
            onClick={() => actions.onOpen(o)}
            className="text-left decoration-action underline-offset-4 group-hover:underline after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-action"
          >
            {o.title}
          </button>
        </h3>
        {o.organizer && <p className="mt-1 text-[13px] leading-[19px] text-muted">{o.organizer}</p>}
        {o.benefits.length > 0 && <p className="mt-1 text-[13px] leading-[19px] text-ink-2">{o.benefits.join(" · ")}</p>}
        {o.note && <p className="mt-2 text-[12px] text-muted">{o.note}</p>}
      </div>
    </article>
  );
}
