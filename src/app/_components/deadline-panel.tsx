"use client";

import type { Opportunity } from "@/lib/opportunity";
import { itemKey, keyDate } from "@/lib/personalize";
import { dateStub } from "./format";

const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** The same deadlines on phones: one short row that scrolls sideways, so the cards start sooner. */
export function DeadlineStrip({
  title,
  items,
  today,
  onOpen,
  onSeeAgenda,
}: {
  title: string;
  items: Opportunity[];
  today: string | null;
  onOpen: (o: Opportunity) => void;
  onSeeAgenda: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mb-8 lg:hidden" aria-labelledby="strip-title">
      <div className="mb-2.5 flex items-baseline gap-3">
        <h2 id="strip-title" className="font-mono text-[14px] font-semibold tracking-[-0.045em]">
          {title}
        </h2>
        <button type="button" onClick={onSeeAgenda} className="ml-auto font-mono text-[12.5px] font-semibold text-action underline underline-offset-4">
          Agenda
        </button>
      </div>
      <ul className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((o) => {
          const stub = dateStub(o, today);
          const date = keyDate(o)!;
          return (
            <li key={itemKey(o)} className="w-[208px] shrink-0 snap-start">
              <button
                type="button"
                onClick={() => onOpen(o)}
                className="flex h-full w-full items-stretch overflow-hidden rounded-md border border-line bg-card text-left"
              >
                <span
                  className={`flex w-12 shrink-0 flex-col items-center justify-center border-r font-mono text-[11px] leading-[14px] font-semibold ${
                    stub.urgent ? "border-[color-mix(in_srgb,var(--urgent)_28%,var(--line))] bg-urgent-bg text-urgent" : "border-line bg-sky-tint text-action"
                  }`}
                >
                  <b className="text-[17px] leading-5 font-semibold tracking-[-0.04em]">{date.slice(8, 10)}</b>
                  {MONTH_ABBR[Number(date.slice(5, 7)) - 1]}
                </span>
                <span className="min-w-0 px-2.5 py-2">
                  <span className="line-clamp-2 font-mono text-[12.5px] leading-[17px] font-semibold tracking-[-0.03em]">{o.title}</span>
                  {stub.hint && <span className={`mt-0.5 block text-[11.5px] ${stub.urgent ? "text-urgent" : "text-muted"}`}>{stub.hint}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The next deadlines (of saved items, or what closes soon nearby), as a timeline in the side rail. */
export function DeadlinePanel({
  title,
  subtitle,
  items,
  today,
  onOpen,
  onSeeAgenda,
}: {
  title: string;
  subtitle: string;
  items: Opportunity[];
  today: string | null;
  onOpen: (o: Opportunity) => void;
  onSeeAgenda: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="grid-bg spot rounded-lg border border-line bg-card p-5" aria-labelledby="deadlines-title">
      <h2 id="deadlines-title" className="font-mono text-[15px] leading-[22px] font-semibold tracking-[-0.045em]">
        {title}
      </h2>
      <p className="mt-0.5 text-[12.5px] leading-[18px] text-muted">{subtitle}</p>
      <ul className="mt-3.5">
        {items.map((o) => {
          const stub = dateStub(o, today);
          const date = keyDate(o)!;
          return (
            <li key={itemKey(o)} className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0">
              <span className={`w-11 shrink-0 text-center font-mono text-[11.5px] leading-[14px] font-semibold ${stub.urgent ? "text-urgent" : "text-muted"}`}>
                <b className={`block text-[19px] leading-[22px] font-semibold tracking-[-0.04em] ${stub.urgent ? "" : "text-ink"}`}>{date.slice(8, 10)}</b>
                {MONTH_ABBR[Number(date.slice(5, 7)) - 1]}
              </span>
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onOpen(o)}
                  className="line-clamp-2 text-left font-mono text-[12.5px] leading-5 font-semibold tracking-[-0.03em] decoration-action underline-offset-[3px] hover:underline"
                >
                  {o.title}
                </button>
                {stub.hint && <p className="text-[12px] leading-[17px] text-muted">{stub.label === "Inscrições até" ? stub.hint.replace(/^fecha/, "Inscrições fecham") : stub.hint}</p>}
              </div>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={onSeeAgenda}
        className="mt-1 inline-flex min-h-11 items-center font-mono text-[13px] font-semibold tracking-tight text-action underline underline-offset-4 hover:text-action-strong"
      >
        Abrir a agenda completa
      </button>
    </section>
  );
}
