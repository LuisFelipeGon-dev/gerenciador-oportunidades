"use client";

import type { Opportunity } from "@/lib/opportunity";
import { itemKey, keyDate } from "@/lib/personalize";
import { dateStub } from "./format";

const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

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
