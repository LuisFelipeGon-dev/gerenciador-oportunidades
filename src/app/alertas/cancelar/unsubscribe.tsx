"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { browserClient } from "@/lib/supabase/browser";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function unsubscribe(token: string): Promise<"done" | "invalid"> {
  const supabase = browserClient();
  if (!supabase || !UUID.test(token)) return "invalid";
  const { data, error } = await supabase.rpc("unsubscribe_alerts", { token });
  return !error && data === true ? "done" : "invalid";
}

/** Turns the weekly e-mail off for the token in the link (?t=...), with no login. */
export function Unsubscribe() {
  const [state, setState] = useState<"working" | "done" | "invalid">("working");

  useEffect(() => {
    // Read here, in the browser: the page itself stays static.
    void unsubscribe(new URLSearchParams(window.location.search).get("t") ?? "").then(setState);
  }, []);

  if (state === "working") return <p className="mt-4 text-[15px] text-muted">Cancelando…</p>;

  return (
    <>
      <p className="mt-4 text-[16px]">
        {state === "done"
          ? "Pronto, você não vai mais receber o resumo semanal."
          : "Este link não é válido. Para parar o resumo, desmarque a opção no seu perfil."}
      </p>
      {state === "done" && (
        <p className="mt-2 text-[14px] text-muted">Mudou de ideia? Dá para ligar de novo no seu perfil, em “Resumo por e-mail”.</p>
      )}
      <Link href="/" className="mt-6 inline-block text-[14px] font-semibold text-action">
        Ir para o site
      </Link>
    </>
  );
}
