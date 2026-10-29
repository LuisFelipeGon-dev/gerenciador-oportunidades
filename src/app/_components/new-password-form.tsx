"use client";

import { useState } from "react";
import { MIN_PASSWORD_LENGTH, passwordAuthError, validateNewPassword } from "@/lib/password";
import { browserClient } from "@/lib/supabase/browser";

const field = "mt-1 w-full rounded-xl border border-line bg-card px-3.5 py-3 text-[16px] focus:border-action focus:outline-none";

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
    <form onSubmit={submit} className="grid gap-4">
      <label className="block text-[14px] font-semibold">
        Senha nova
        <input name="password" type="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" className={field} />
        <span className="mt-1 block text-[12.5px] font-normal text-muted">Pelo menos {MIN_PASSWORD_LENGTH} caracteres.</span>
      </label>
      <label className="block text-[14px] font-semibold">
        Repita a senha nova
        <input name="confirm" type="password" required autoComplete="new-password" className={field} />
      </label>
      {error && (
        <p role="alert" className="rounded-lg bg-urgent-bg px-3 py-2 text-[14px] font-semibold text-urgent">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="rounded-lg bg-open-bg px-3 py-2 text-[14px] font-semibold text-open">
          {doneMessage}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="justify-self-start rounded-xl bg-action px-5 py-3 text-[15px] font-bold text-card hover:bg-action-strong disabled:opacity-60"
      >
        {busy ? "Salvando…" : submitLabel}
      </button>
    </form>
  );
}
