"use client";

import { useEffect, useRef, useState } from "react";
import { buildIcs, calendarEventFor, googleCalendarUrl } from "@/lib/calendar";
import type { Opportunity } from "@/lib/opportunity";
import { checksFor, itemKey, type Profile } from "@/lib/personalize";
import { Avatar, CheckList, ModeTag, TypeTag, type CardActions } from "./cards";
import { SOURCE_LABEL, dateStub, instantDate, longDate, placeLine, shortDate, topicTags } from "./format";
import { ArrowIcon, BookmarkIcon, CalendarIcon, ShareIcon, XIcon } from "./icons";

const REPORT_URL = "https://github.com/LuisFelipeGon-dev/gerenciador-oportunidades/issues/new";

/** A plain description of what this kind of opportunity is, built only from known facts. */
function whatItIs(o: Opportunity): string {
  const where = o.modality === "online" ? "online" : `presencial em ${placeLine(o)}`;
  switch (o.type) {
    case "hackathon":
      return o.modality === "online"
        ? "Um hackathon online: você desenvolve um projeto, sozinho ou em equipe, dentro do prazo e envia pela plataforma do organizador para concorrer."
        : `Um hackathon ${where}: alguns dias desenvolvendo um projeto em equipe no local do evento, com apresentação no final.`;
    case "event": {
      const base = `Um evento ${where}${o.organizer ? `, organizado pelo ${o.organizer}` : ""}.`;
      return o.tags.includes("DevFest")
        ? `${base} O DevFest é a conferência anual das comunidades Google Developer Groups, com palestras sobre tecnologias como IA, cloud e desenvolvimento web e mobile.`
        : base;
    }
    case "ambassador":
      return `Um programa em que estudantes representam ${o.organizer ? `a ${o.organizer}` : "a empresa"} na própria faculdade, organizando atividades e comunidades.`;
    default:
      return `Uma oportunidade ${where}.`;
  }
}

function shareUrlFor(o: Opportunity): string {
  const url = new URL(window.location.href);
  url.hash = `o=${itemKey(o)}`;
  return url.toString();
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="mb-2 text-[12.5px] font-bold tracking-wider text-muted uppercase">{title}</h3>
      {children}
    </section>
  );
}

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
  const saved = actions.isSaved(o);
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

  const keys = [
    { label: stub.label, value: `${stub.date}${stub.hint ? ` · ${stub.hint}` : ""}` },
    { label: "Onde", value: o.modality === "online" ? "Online" : placeLine(o) },
    ...(o.benefits[0] ? [{ label: "Você ganha", value: o.benefits[0] }] : o.organizer ? [{ label: "Quem organiza", value: o.organizer }] : []),
  ];

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="detail-title"
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-[560px] overflow-hidden bg-card p-0 text-ink shadow-[-12px_0_40px_rgba(9,20,48,0.18)] backdrop:bg-[rgba(9,20,48,0.45)] open:flex open:flex-col open:animate-[drawer-in_.25s_cubic-bezier(.2,.8,.2,1)]"
    >
      <header className="on-navy relative bg-navy px-5 pt-5 pb-5 text-white sm:px-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-3.5 right-3.5 grid size-9 place-items-center rounded-full bg-navy-2 hover:bg-white/20"
        >
          <XIcon className="size-5" />
        </button>
        <div className="flex items-center gap-3 pr-10">
          <Avatar o={o} size="sm" />
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-md bg-white">
              <TypeTag o={o} />
            </span>
            <ModeTag o={o} onNavy />
          </div>
        </div>
        <h2 id="detail-title" className="mt-3 pr-8 text-2xl leading-tight font-extrabold tracking-tight">
          {o.title}
        </h2>
        {o.organizer && <p className="mt-1 text-sm text-navy-text">{o.organizer}</p>}
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {keys.map((k) => (
            <div key={k.label} className="rounded-xl bg-navy-2 px-3 py-2.5">
              <dt className="text-[11px] font-semibold tracking-wide text-navy-text uppercase">{k.label}</dt>
              <dd className="mt-0.5 text-[15px] leading-snug font-bold">{k.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        <Section title="O que é">
          <p className="max-w-[65ch] text-[15px] leading-relaxed">{whatItIs(o)}</p>
          <p className="mt-2 rounded-lg bg-ground px-3 py-2 text-[12.5px] text-muted">
            Descrição geral deste tipo de oportunidade. O tema, as regras e os requisitos completos estão na página oficial.
          </p>
        </Section>

        {topics.length > 0 && (
          <Section title="Temas">
            <ul className="flex flex-wrap gap-1.5">
              {topics.map((t) => (
                <li key={t} className="rounded-md bg-ground px-2.5 py-1 text-[13px] font-semibold">
                  {t}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {o.benefits.length > 0 && (
          <Section title="O que você ganha">
            <ul className="list-disc space-y-1 pl-5 text-[15px]">
              {o.benefits.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Posso participar?">
          <CheckList checks={checksFor(o, profile, today)} size="md" />
          {!profile && <p className="mt-2 text-[13px] text-muted">Monte seu perfil para ver se você se encaixa.</p>}
        </Section>

        <Section title="Datas">
          <ul className="space-y-1 text-[15px]">
            {o.registrationDeadline && <li>Inscrições até {longDate(o.registrationDeadline)}</li>}
            {o.startsOn && (
              <li>
                {o.endsOn && o.endsOn !== o.startsOn
                  ? `De ${shortDate(o.startsOn)} a ${longDate(o.endsOn)}`
                  : `Em ${longDate(o.startsOn)}`}
              </li>
            )}
            {!o.registrationDeadline && !o.startsOn && <li>{stub.label}: {stub.date}</li>}
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
      </div>

      <footer className="border-t border-line px-5 py-4 sm:px-6">
        <a
          href={o.officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl bg-action px-4 py-3 text-[15px] font-bold text-white hover:bg-navy"
        >
          Ver página oficial
          <ArrowIcon className="size-4" />
        </a>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => actions.onToggleSave(o)}
            aria-pressed={saved}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[13.5px] font-semibold ${
              saved ? "border-action bg-action text-white" : "border-line hover:border-ink"
            }`}
          >
            <BookmarkIcon filled={saved} />
            {saved ? "Salvo" : "Salvar"}
          </button>
          {event && (
            <details className="relative">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[13.5px] font-semibold hover:border-ink [&::-webkit-details-marker]:hidden">
                <CalendarIcon />
                Adicionar à agenda
              </summary>
              <div className="absolute bottom-full left-0 z-10 mb-2 w-60 rounded-xl border border-line bg-card p-1.5 shadow-[0_8px_24px_rgba(9,20,48,0.16)]">
                <a
                  href={googleCalendarUrl(event)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg px-3 py-2 text-[14px] font-semibold hover:bg-ground"
                >
                  Google Agenda
                </a>
                <button
                  type="button"
                  onClick={downloadIcs}
                  className="block w-full rounded-lg px-3 py-2 text-left text-[14px] font-semibold hover:bg-ground"
                >
                  iPhone, Outlook e outros (.ics)
                </button>
                <p className="px-3 pt-1 pb-1.5 text-[12px] text-muted">
                  {event.title} · com lembrete 2 dias antes
                </p>
              </div>
            </details>
          )}
          <button
            type="button"
            onClick={share}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[13.5px] font-semibold hover:border-ink"
          >
            <ShareIcon />
            {shared ? "Aberto no WhatsApp" : "Compartilhar"}
          </button>
        </div>
        <p className="mt-3 text-[12px] text-muted">
          Verificado em {instantDate(o.verifiedAt)} · fonte: {SOURCE_LABEL[o.source] ?? o.source} ·{" "}
          <a
            className="underline underline-offset-2 hover:text-ink"
            href={`${REPORT_URL}?${new URLSearchParams({
              title: `Erro em: ${o.title}`,
              labels: "erro-de-dado",
              body: `Item: ${itemKey(o)}\nPágina oficial: ${o.officialUrl}\n\nO que está errado:\n`,
            })}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            reportar erro
          </a>
        </p>
      </footer>
    </dialog>
  );
}
