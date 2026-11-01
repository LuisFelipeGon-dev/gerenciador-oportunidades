"use client";

import { useEffect, useRef, useState } from "react";
import { REPORT_MESSAGE_MAX, REPORT_REASONS, canReportAgain, validateReport } from "@/lib/reports";
import { browserClient } from "@/lib/supabase/browser";

// When each item was last reported from this browser, to avoid accidental repeats.
const SENT_KEY = "oportunidades:reportes:v1";

function readSent(): Record<string, number> {
  try {
    return JSON.parse(window.localStorage.getItem(SENT_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

function rememberSent(itemKey: string) {
  try {
    window.localStorage.setItem(SENT_KEY, JSON.stringify({ ...readSent(), [itemKey]: Date.now() }));
  } catch {
    // Storage blocked: the database limits still apply.
  }
}

/** "Reportar erro": a short form that stores the report without identifying who sent it. */
export function ReportForm({ itemKey }: { itemKey: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // The form opens at the end of the drawer: bring it, and its send button, into view.
  useEffect(() => {
    if (open) formRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const result = validateReport({
      itemKey,
      reason: String(data.get("reason") ?? ""),
      message: String(data.get("message") ?? ""),
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (!canReportAgain(readSent()[itemKey] ?? null, Date.now())) {
      setState("sent");
      return;
    }
    const supabase = browserClient();
    if (!supabase) {
      setError("Não foi possível enviar agora. Tente de novo mais tarde.");
      return;
    }
    setState("sending");
    const { error: insertError } = await supabase.from("reports").insert(result.report);
    if (insertError) {
      setState("idle");
      setError("Não foi possível enviar agora. Tente de novo mais tarde.");
      return;
    }
    rememberSent(itemKey);
    setError(null);
    setState("sent");
  }

  if (state === "sent") {
    return <p className="mt-3 text-[13px] font-semibold text-open">Obrigado! Vamos conferir na página oficial e corrigir.</p>;
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="underline underline-offset-2 hover:text-ink">
        reportar erro
      </button>
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="mt-3 rounded-md border border-line p-3 text-ink">
      <fieldset>
        <legend className="text-[13.5px] font-bold">O que está errado?</legend>
        <div className="mt-2 grid gap-1.5">
          {REPORT_REASONS.map((r) => (
            <label key={r.id} className="flex min-h-9 cursor-pointer items-center gap-2.5 text-[13.5px]">
              <input type="radio" name="reason" value={r.id} className="check" />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-3 block text-[13px] font-semibold">
        Detalhes <span className="font-normal text-muted">(opcional, a não ser em “Outro problema”)</span>
        <textarea
          name="message"
          maxLength={REPORT_MESSAGE_MAX}
          rows={3}
          className="mt-1 w-full rounded-md border border-line bg-card px-3 py-2 text-[14px] transition-[border-color,box-shadow] focus:border-action focus:shadow-[0_0_0_3px_var(--sky-tint)] focus:outline-none"
        />
      </label>
      <p className="mt-1 text-[12px] text-muted">Não pedimos nem guardamos seu nome ou e-mail.</p>
      {error && (
        <p role="alert" className="mt-2 text-[13px] font-semibold text-urgent">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={state === "sending"}
          className="inline-flex h-10 items-center rounded-md bg-btn px-4 font-mono text-[13px] font-semibold tracking-tight text-on-btn hover:bg-btn-hover disabled:opacity-60"
        >
          {state === "sending" ? "Enviando…" : "Enviar"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="inline-flex h-10 items-center rounded-md border border-line px-4 font-mono text-[13px] font-semibold tracking-tight hover:border-ink">
          Cancelar
        </button>
      </div>
    </form>
  );
}
