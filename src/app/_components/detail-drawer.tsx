"use client";

import { useEffect, useRef, useState } from "react";
import { buildIcs, calendarEventFor, googleCalendarUrl } from "@/lib/calendar";
import type { Opportunity } from "@/lib/opportunity";
import { checksFor, itemKey, type Profile } from "@/lib/personalize";
import { CheckList, FitBadge, ModeTag, OfficialLink, SaveButton, TypeTag, type CardActions } from "./cards";
import { SOURCE_LABEL, dateStub, instantDate, longDate, placeLine, shortDate, topicTags, whatItIs } from "./format";
import { CalendarIcon, ShareIcon, XIcon } from "./icons";
import { ReportForm } from "./report-form";

function shareUrlFor(o: Opportunity): string {
  const url = new URL(window.location.href);
  url.hash = `o=${itemKey(o)}`;
  return url.toString();
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="mb-2.5 font-mono text-[13px] leading-5 font-semibold tracking-tight">{title}</h3>
      {children}
    </section>
  );
}

const secondaryButton =
  "inline-flex h-11 items-center gap-2 rounded-md border border-line-strong px-3.5 font-mono text-[12.5px] font-semibold tracking-tight text-ink transition-colors hover:border-action hover:bg-sky-tint";

export function DetailDrawer({
  o,
  today,
  profile,
  actions,
  onClose,
}: {
  o: Opportunity | null;
  today: string;
  profile: Profile | null;
  actions: CardActions;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (o && !dialog.open) dialog.showModal();
    if (!o && dialog.open) dialog.close();
  }, [o]);

  if (!o) return <dialog ref={ref} onClose={onClose} className="hidden" />;

  const stub = dateStub(o, today);
  const topics = topicTags(o);
  const checks = checksFor(o, profile, today);
  const event = typeof window === "undefined" ? null : calendarEventFor(o, shareUrlFor(o), today);

  function downloadIcs() {
    if (!event) return;
    const blob = new Blob([buildIcs(event, new Date())], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${o!.title.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 60)}.ics`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function share() {
    const url = shareUrlFor(o!);
    const text = `${o!.title} · ${stub.label.toLowerCase()} ${stub.date}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: o!.title, text, url });
      } catch {
        // Cancelled by the person: nothing to do.
      }
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank", "noopener");
    setShared(true);
  }

  const facts = [
    { label: stub.label, value: stub.date, sub: stub.hint, urgent: stub.urgent },
    { label: "Onde", value: o.modality === "online" ? "Online" : placeLine(o), sub: o.modality === "online" ? "De onde você estiver" : null, urgent: false },
    ...(o.benefits[0] ? [{ label: "Você ganha", value: o.benefits[0], sub: null, urgent: false }] : []),
    ...(o.organizer ? [{ label: "Quem organiza", value: o.organizer, sub: null, urgent: false }] : []),
    ...(o.cost ? [{ label: "Custo", value: o.cost, sub: null, urgent: false }] : []),
  ];

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="detail-title"
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-[540px] overflow-y-auto overscroll-contain border-l border-line-strong bg-card p-0 text-ink shadow-[-20px_0_60px_rgb(0_0_0/0.35)] open:block open:animate-[drawer-in_.32s_cubic-bezier(.2,.8,.2,1)] max-sm:top-auto max-sm:bottom-0 max-sm:h-[92dvh] max-sm:max-w-none max-sm:rounded-t-md max-sm:border-t max-sm:border-l-0 max-sm:open:animate-[sheet-in_.32s_cubic-bezier(.2,.8,.2,1)]"
    >
      {/* The whole drawer scrolls as one: a fixed header and footer left little room on phones. */}
      <div className="grid-bg px-5 pt-6 pb-5 sm:px-8 sm:pt-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
            <TypeTag o={o} />
            <ModeTag o={o} />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="-mt-1 grid size-11 shrink-0 place-items-center rounded-md border border-line text-ink transition-colors hover:border-line-strong hover:bg-card-2"
          >
            <XIcon className="size-[18px]" />
          </button>
        </div>
        <h2 id="detail-title" className="mt-3 font-mono text-[21px] leading-[27px] font-semibold tracking-[-0.045em] text-balance sm:text-[24px] sm:leading-[30px]">
          {o.title}
        </h2>

        <dl className="mt-6 grid grid-cols-[90px_1fr] gap-x-4 gap-y-3 border-y border-line py-5 sm:grid-cols-[120px_1fr]">
          {facts.map((f) => (
            <div key={f.label} className="contents">
              <dt className="text-[13px] leading-[22px] font-semibold text-muted">{f.label}</dt>
              <dd className={`min-w-0 text-[15px] leading-[22px] font-semibold ${f.urgent ? "text-urgent" : ""}`}>
                {f.value}
                {f.sub && <small className={`block text-[13px] leading-[19px] font-normal ${f.urgent ? "" : "text-muted"}`}>{f.sub}</small>}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="px-5 pb-6 sm:px-8">
        <Section title="Posso participar?">
          <div className="flex flex-col gap-2.5">
            {profile && <FitBadge checks={checks} />}
            <CheckList checks={checks} size="md" />
          </div>
          {!profile && <p className="mt-2 text-[13px] text-muted">Monte seu perfil para ver se você se encaixa.</p>}
        </Section>

        <Section title="O que é">
          {/* A call's own summary (read from its PDF) beats the generic description of its type. */}
          <p className="max-w-[65ch] text-[15px] leading-relaxed text-ink-2">{o.summary ?? whatItIs(o)}</p>
          <p className="mt-2.5 rounded-sm border-l-2 border-line-strong bg-card-2 px-3 py-2 text-[12.5px] leading-[18px] text-muted">
            {o.summary
              ? "Resumo lido automaticamente do edital. Prazos, requisitos e documentos estão no PDF oficial."
              : "Descrição geral deste tipo de oportunidade. O tema, as regras e os requisitos completos estão na página oficial."}
          </p>
        </Section>

        {topics.length > 0 && (
          <Section title="Temas">
            <ul className="flex flex-wrap gap-1.5">
              {topics.map((t) => (
                <li key={t} className="rounded-sm border border-line bg-card-2 px-2.5 py-1 font-mono text-[12px] font-semibold tracking-tight">
                  {t}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {o.benefits.length > 1 && (
          <Section title="O que você ganha">
            <ul className="list-disc space-y-1 pl-5 text-[15px] marker:text-action">
              {o.benefits.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Datas">
          <ul className="space-y-1 text-[15px]">
            {o.registrationDeadline && <li>Inscrições até {longDate(o.registrationDeadline)}</li>}
            {o.startsOn && (
              <li>
                {o.endsOn && o.endsOn !== o.startsOn ? `De ${shortDate(o.startsOn)} a ${longDate(o.endsOn)}` : `Em ${longDate(o.startsOn)}`}
              </li>
            )}
            {!o.registrationDeadline && !o.startsOn && (
              <li>
                {stub.label}: {stub.date}
              </li>
            )}
          </ul>
        </Section>

        {o.modality !== "online" && o.location.raw && (
          <Section title="Onde">
            <p className="text-[15px]">{o.location.raw.replace(/[\s,;·-]+$/, "")}</p>
          </Section>
        )}

        {o.note && (
          <Section title="Atenção">
            <p className="text-[15px]">{o.note}</p>
          </Section>
        )}

        <Section title="Fonte">
          <div className="text-[13px] text-muted">
            Verificado em {instantDate(o.verifiedAt)} · fonte: {SOURCE_LABEL[o.source] ?? o.source}
            {o.alsoOn.length > 0 && (
              <>
                {" "}
                · também em:{" "}
                {o.alsoOn.map((a, i) => (
                  <span key={`${a.source}:${a.sourceId}`}>
                    {i > 0 && ", "}
                    <a className="underline underline-offset-2 hover:text-ink" href={a.officialUrl} target="_blank" rel="noopener noreferrer">
                      {SOURCE_LABEL[a.source] ?? a.source}
                    </a>
                  </span>
                ))}
              </>
            )}{" "}
            · <ReportForm key={itemKey(o)} itemKey={itemKey(o)} />
          </div>
        </Section>
      </div>

      <footer className="border-t border-line px-5 pt-4 pb-6 sm:px-8">
        <div className="flex gap-2.5">
          <OfficialLink o={o} className="h-12 flex-1 text-[14px]" />
          <SaveButton o={o} actions={actions} />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {event && (
            <details className="relative">
              <summary className={`${secondaryButton} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
                <CalendarIcon />
                Adicionar à agenda
              </summary>
              <div className="absolute bottom-full left-0 z-10 mb-2 w-64 rounded-md border border-line-strong bg-card p-1.5 shadow-[0_20px_50px_-12px_rgb(var(--shadow-rgb)/0.45)]">
                <a
                  href={googleCalendarUrl(event)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-sm px-3 py-2.5 text-[14px] font-semibold hover:bg-sky-tint"
                >
                  Google Agenda
                </a>
                <button type="button" onClick={downloadIcs} className="block w-full rounded-sm px-3 py-2.5 text-left text-[14px] font-semibold hover:bg-sky-tint">
                  iPhone, Outlook e outros (.ics)
                </button>
                <p className="px-3 pt-1 pb-1.5 text-[12px] text-muted">{event.title} · com lembrete 2 dias antes</p>
              </div>
            </details>
          )}
          <button type="button" onClick={share} className={secondaryButton}>
            <ShareIcon />
            {shared ? "Aberto no WhatsApp" : "Compartilhar"}
          </button>
        </div>
        <p className="mt-3 text-[12px] leading-[17px] text-muted">A página oficial é sempre o destino: confira regras e prazos lá antes de se inscrever.</p>
      </footer>
    </dialog>
  );
}
