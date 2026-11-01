"use client";

import { useState } from "react";
import { MIN_PASSWORD_LENGTH, passwordAuthError, validateNewPassword } from "@/lib/password";
import { browserClient } from "@/lib/supabase/browser";
import { fieldClass } from "./fields";

const field = `${fieldClass} mt-1 h-12 text-[16px]`;

/** Sets the password of the signed-in account (after "Esqueci minha senha", or in Ajustes). */
export function NewPasswordForm({ submitLabel, doneMessage }: { submitLabel: string; doneMessage: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password") ?? "");
    const invalid = validateNewPassword(password, String(data.get("confirm") ?? ""));
    if (invalid) return setError(invalid);
    const supabase = browserClient();
    if (!supabase) return setError("Indisponível no momento.");
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(passwordAuthError(error.message));
    form.reset();
    setDone(true);
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <label className="block text-[14px] font-semibold">
        Senha nova
        <input name="password" type="password" autoComplete="new-password" className={field} />
        <span className="mt-1 block text-[12.5px] font-normal text-muted">Pelo menos {MIN_PASSWORD_LENGTH} caracteres.</span>
      </label>
      <label className="block text-[14px] font-semibold">
        Repita a senha nova
        <input name="confirm" type="password" autoComplete="new-password" className={field} />
      </label>
      {error && (
        <p role="alert" className="rounded-md bg-urgent-bg px-3 py-2 text-[14px] font-semibold text-urgent">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="rounded-md bg-open-bg px-3 py-2 text-[14px] font-semibold text-open">
          {doneMessage}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-12 items-center justify-self-start rounded-md bg-btn px-5 font-mono text-[14px] font-semibold tracking-tight text-on-btn transition-[background-color,transform] hover:bg-btn-hover active:scale-[.98] disabled:opacity-60"
      >
        {busy ? "Salvando…" : submitLabel}
      </button>
    </form>
  );
}
