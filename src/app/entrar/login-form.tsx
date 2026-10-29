"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { rememberConsent, useSession } from "@/lib/account";
import { MIN_PASSWORD_LENGTH, passwordAuthError, validateNewPassword } from "@/lib/password";
import { browserClient } from "@/lib/supabase/browser";

const field = "mt-1 w-full rounded-xl border border-line bg-card px-3.5 py-3 text-[16px] focus:border-action focus:outline-none";

function friendly(message: string): string {
  if (/rate limit|too many|seconds/i.test(message)) return "Muitos pedidos seguidos. Espere alguns minutos e tente de novo.";
  if (/expired|invalid/i.test(message)) return "Código inválido ou vencido. Peça um novo e-mail.";
  if (/email/i.test(message) && /invalid/i.test(message)) return "Esse e-mail não parece válido.";
  return "Não deu certo agora. Tente de novo em instantes.";
}

function ConsentField() {
  return (
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
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-lg bg-urgent-bg px-3 py-2 text-[14px] font-semibold text-urgent">
      {children}
    </p>
  );
}

const primary = "rounded-xl bg-action px-5 py-3.5 text-[15px] font-bold text-card hover:bg-action-strong disabled:opacity-60";
const linkButton = "text-[14px] font-semibold text-action hover:underline";

/** Signed-in redirect plus the two ways in: a code by e-mail, or e-mail and password. */
export function LoginForm() {
  const router = useRouter();
  const session = useSession();
  const [method, setMethod] = useState<"code" | "password">("code");

  // Arriving from the magic link: the client exchanges the code in the URL and signs in.
  useEffect(() => {
    if (session) router.replace("/");
  }, [session, router]);

  if (session) return <p className="text-[15px]">Você já entrou. Abrindo o Topa?…</p>;

  return (
    <>
      <div className="mb-5 grid grid-cols-2 rounded-xl bg-ground p-1" role="tablist" aria-label="Como entrar">
        {(
          [
            ["code", "Código por e-mail"],
            ["password", "Senha"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={method === id}
            onClick={() => setMethod(id)}
            className={`rounded-lg py-2 text-[14px] font-semibold transition-[background-color,box-shadow] ${
              method === id ? "bg-card shadow-[0_1px_3px_rgb(var(--shadow-rgb)/0.15)]" : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {method === "code" ? <CodeLogin /> : <PasswordLogin />}
    </>
  );
}

/** E-mail, then a 6-digit code (or the link) by e-mail. Creates the account on first use. */
function CodeLogin() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return step === "email" ? (
    <form onSubmit={sendEmail} className="grid gap-4">
      <label className="block text-[14px] font-semibold">
        Seu e-mail
        <input name="email" type="email" required autoComplete="email" inputMode="email" className={field} />
      </label>
      <ConsentField />
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

/** E-mail and password: sign in, create an account, or get a link to set a new password. */
function PasswordLogin() {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [sent, setSent] = useState<{ kind: "confirm" | "reset"; email: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function switchTo(next: typeof mode) {
    setMode(next);
    setError(null);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const supabase = browserClient();
    if (!supabase) return setError("Login indisponível no momento.");
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "").trim().toLowerCase();
    const password = String(data.get("password") ?? "");

    if (mode === "signup") {
      const invalid = validateNewPassword(password, String(data.get("confirm") ?? ""));
      if (invalid) return setError(invalid);
      if (data.get("consent") !== "on") return setError("Para criar a conta, aceite a política de privacidade.");
    }

    setBusy(true);
    setError(null);
    if (mode === "signin") {
      // On success the session changes and LoginForm sends the person home.
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) setError(passwordAuthError(error.message));
    } else if (mode === "signup") {
      rememberConsent();
      const { data: result, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/entrar` },
      });
      setBusy(false);
      if (error) setError(passwordAuthError(error.message));
      else if (!result.session) setSent({ kind: "confirm", email });
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/entrar/nova-senha` });
      setBusy(false);
      if (error) setError(passwordAuthError(error.message));
      else setSent({ kind: "reset", email });
    }
  }

  if (sent) {
    return (
      <div className="grid gap-4">
        <p className="text-[15px]">
          Enviamos um e-mail para <strong>{sent.email}</strong>.{" "}
          {sent.kind === "confirm"
            ? "Clique no link dele para confirmar a conta e entrar."
            : "Clique no link dele para criar uma senha nova."}
        </p>
        <p className="text-[13px] text-muted">Não chegou? Olhe a caixa de spam. Pode levar um ou dois minutos.</p>
        <button
          type="button"
          onClick={() => {
            setSent(null);
            switchTo("signin");
          }}
          className={linkButton}
        >
          Voltar para entrar com senha
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4" key={mode}>
      <label className="block text-[14px] font-semibold">
        Seu e-mail
        <input name="email" type="email" required autoComplete="email" inputMode="email" className={field} />
      </label>
      {mode !== "forgot" && (
        <label className="block text-[14px] font-semibold">
          {mode === "signup" ? "Crie uma senha" : "Senha"}
          <input
            name="password"
            type="password"
            required
            minLength={mode === "signup" ? MIN_PASSWORD_LENGTH : undefined}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className={field}
          />
          {mode === "signup" && <span className="mt-1 block text-[12.5px] font-normal text-muted">Pelo menos {MIN_PASSWORD_LENGTH} caracteres.</span>}
        </label>
      )}
      {mode === "signup" && (
        <>
          <label className="block text-[14px] font-semibold">
            Repita a senha
            <input name="confirm" type="password" required autoComplete="new-password" className={field} />
          </label>
          <ConsentField />
        </>
      )}
      {error && <Alert>{error}</Alert>}
      <button type="submit" disabled={busy} className={primary}>
        {busy ? "Aguarde…" : mode === "signin" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link para criar senha nova"}
      </button>
      <div className="flex flex-wrap justify-between gap-2">
        {mode === "signin" ? (
          <>
            <button type="button" onClick={() => switchTo("forgot")} className={linkButton}>
              Esqueci minha senha
            </button>
            <button type="button" onClick={() => switchTo("signup")} className={linkButton}>
              Criar conta com senha
            </button>
          </>
        ) : (
          <button type="button" onClick={() => switchTo("signin")} className={linkButton}>
            Já tenho senha
          </button>
        )}
      </div>
      {mode === "signin" && (
        <p className="text-[13px] text-muted">Sempre entrou pelo código? Use “Esqueci minha senha” para criar uma.</p>
      )}
    </form>
  );
}
