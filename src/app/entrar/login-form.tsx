"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { rememberConsent, useSession } from "@/lib/account";
import { browserClient } from "@/lib/supabase/browser";

const field = "mt-1 w-full rounded-xl border border-line bg-card px-3.5 py-3 text-[16px] focus:border-action focus:outline-none";

function friendly(message: string): string {
  if (/rate limit|too many|seconds/i.test(message)) return "Muitos pedidos seguidos. Espere alguns minutos e tente de novo.";
  if (/expired|invalid/i.test(message)) return "Código inválido ou vencido. Peça um novo e-mail.";
  if (/email/i.test(message) && /invalid/i.test(message)) return "Esse e-mail não parece válido.";
  return "Não deu certo agora. Tente de novo em instantes.";
}

export function LoginForm() {
  const router = useRouter();
  const session = useSession();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Arriving from the magic link: the client exchanges the code in the URL and signs in.
  useEffect(() => {
    if (session) router.replace("/");
  }, [session, router]);

  async function sendEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const supabase = browserClient();
    if (!supabase) return setError("Login indisponível no momento.");
    const data = new FormData(e.currentTarget);
    const address = String(data.get("email") ?? "").trim().toLowerCase();
    if (data.get("consent") !== "on") return setError("Para criar a conta, aceite a política de privacidade.");
    setBusy(true);
    setError(null);
    rememberConsent();
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: `${window.location.origin}/entrar`, shouldCreateUser: true },
    });
    setBusy(false);
    if (error) return setError(friendly(error.message));
    setEmail(address);
    setStep("code");
  }

  async function verify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const supabase = browserClient();
    if (!supabase) return;
    const token = String(new FormData(e.currentTarget).get("code") ?? "").replace(/\D/g, "");
    if (token.length < 6) return setError("Digite os números do código que chegou no e-mail.");
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    setBusy(false);
    if (error) return setError(friendly(error.message));
    router.replace("/");
  }

  if (session) return <p className="text-[15px]">Você já entrou. Abrindo suas oportunidades…</p>;

  return step === "email" ? (
    <form onSubmit={sendEmail} className="grid gap-4">
      <label className="block text-[14px] font-semibold">
        Seu e-mail
        <input name="email" type="email" required autoComplete="email" inputMode="email" className={field} />
      </label>
      <label className="flex items-start gap-2.5 text-[14px]">
        <input name="consent" type="checkbox" className="mt-1 size-4 accent-action" />
        <span>
          Li e aceito a{" "}
          <Link href="/privacidade" target="_blank" className="font-semibold text-action underline underline-offset-2">
            política de privacidade
          </Link>
          . Meu perfil fica salvo na conta e posso apagar tudo quando quiser.
        </span>
      </label>
      {error && (
        <p role="alert" className="rounded-lg bg-urgent-bg px-3 py-2 text-[14px] font-semibold text-urgent">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="rounded-xl bg-action px-5 py-3.5 text-[15px] font-bold text-card hover:bg-action-strong disabled:opacity-60">
        {busy ? "Enviando…" : "Receber link de acesso"}
      </button>
      <p className="text-[13px] text-muted">Sem senha: a gente manda um link e um código para o seu e-mail. Se for a primeira vez, a conta é criada.</p>
    </form>
  ) : (
    <form onSubmit={verify} className="grid gap-4">
      <p className="text-[15px]">
        Enviamos um e-mail para <strong>{email}</strong>. Clique no link dele <strong>neste aparelho</strong> ou digite o
        código aqui (o código funciona em qualquer aparelho).
      </p>
      <label className="block text-[14px] font-semibold">
        Código do e-mail
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={10}
          className={`${field} text-center text-[22px] font-bold tracking-[0.3em]`}
        />
      </label>
      {error && (
        <p role="alert" className="rounded-lg bg-urgent-bg px-3 py-2 text-[14px] font-semibold text-urgent">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="rounded-xl bg-action px-5 py-3.5 text-[15px] font-bold text-card hover:bg-action-strong disabled:opacity-60">
        {busy ? "Conferindo…" : "Entrar"}
      </button>
      <button
        type="button"
        onClick={() => {
          setStep("email");
          setError(null);
        }}
        className="text-[14px] font-semibold text-action"
      >
        Usar outro e-mail ou pedir de novo
      </button>
      <p className="text-[13px] text-muted">Não chegou? Olhe a caixa de spam. Pode levar um ou dois minutos.</p>
    </form>
  );
}
