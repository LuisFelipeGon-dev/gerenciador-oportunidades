"use client";

import type { Opportunity } from "@/lib/opportunity";
import { itemKey } from "@/lib/personalize";
import { TypeTag } from "./cards";
import { dateStub } from "./format";
import { ArrowIcon } from "./icons";

/** The next deadlines (of saved items, or what closes soon nearby), as a row at the top of "Para você". */
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
    <section className="mb-9" aria-label={title}>
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-[19px] font-extrabold tracking-tight">{title}</h2>
        <button type="button" onClick={onSeeAgenda} className="ml-auto inline-flex items-center gap-1 text-[14px] font-semibold text-action hover:underline">
          Ver agenda
          <ArrowIcon className="size-3.5" />
        </button>
      </div>
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {items.map((o) => {
          const stub = dateStub(o, today);
          return (
            <li key={itemKey(o)} className="w-[220px] shrink-0 snap-start">
              <button
                type="button"
                onClick={() => onOpen(o)}
                className="group flex h-full w-full flex-col gap-2 rounded-2xl border border-line bg-card p-3.5 text-left transition-[border-color,box-shadow] hover:border-ink/30 hover:shadow-[0_8px_24px_-14px_rgb(var(--shadow-rgb)/0.35)]"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[13px] font-extrabold tabular-nums ${stub.urgent ? "bg-urgent-bg text-urgent" : "bg-sky-tint"}`}
                  >
                    {stub.date}
                  </span>
                  <TypeTag o={o} />
                </span>
                <span className="line-clamp-2 text-[14.5px] leading-snug font-bold group-hover:underline group-hover:underline-offset-2">{o.title}</span>
                {stub.hint && <span className={`mt-auto text-[12.5px] font-semibold ${stub.urgent ? "text-urgent" : "text-muted"}`}>{stub.hint}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
