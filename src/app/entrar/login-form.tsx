"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { rememberConsent, useSession } from "@/lib/account";
import { MIN_PASSWORD_LENGTH, passwordAuthError, validateNewPassword } from "@/lib/password";
import { browserClient } from "@/lib/supabase/browser";
import { fieldClass } from "../_components/fields";

const field = `${fieldClass} mt-1 h-12 text-[16px]`;
const primary =
  "inline-flex h-12 items-center justify-center rounded-md bg-btn px-5 font-mono text-[14px] font-semibold tracking-tight text-on-btn transition-[background-color,transform] hover:bg-btn-hover active:scale-[.98] disabled:opacity-60";
const secondary =
  "inline-flex h-12 items-center justify-center rounded-md border border-line-strong px-5 font-mono text-[13.5px] font-semibold tracking-tight text-ink transition-colors hover:border-action hover:text-action";
const linkButton = "min-h-10 text-[14px] font-semibold text-action hover:underline";

// The site checks the fields itself (forms use noValidate), so the messages look the same in
// every browser.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function friendly(message: string): string {
  if (/rate limit|too many|seconds/i.test(message)) return "Muitos pedidos seguidos. Espere alguns minutos e tente de novo.";
  if (/expired|invalid/i.test(message)) return "Código inválido ou vencido. Peça um novo e-mail.";
  if (/email/i.test(message) && /invalid/i.test(message)) return "Esse e-mail não parece válido.";
  return "Não deu certo agora. Tente de novo em instantes.";
}

function ConsentField() {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-[14px]">
      <input name="consent" type="checkbox" className="check mt-0.5" />
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
    <p role="alert" className="rounded-md bg-urgent-bg px-3 py-2 text-[14px] font-semibold text-urgent">
      {children}
    </p>
  );
}

function EmailField() {
  return (
    <label className="block text-[14px] font-semibold">
      Seu e-mail
      <input name="email" type="email" autoComplete="email" inputMode="email" className={field} />
    </label>
  );
}

/** A line with "ou" in the middle, between the two ways in. */
function Or() {
  return (
    <div className="flex items-center gap-3 font-mono text-[12px] text-muted" aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      ou
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** Signed-in redirect, then e-mail and password first; a code by e-mail as the other way in. */
export function LoginForm() {
  const router = useRouter();
  const session = useSession();
  const [method, setMethod] = useState<"password" | "code">("password");

  // Arriving from the magic link: the client exchanges the code in the URL and signs in.
  useEffect(() => {
    if (session) router.replace("/");
  }, [session, router]);

  if (session) return <p className="text-[15px]">Você já entrou. Abrindo o Topa?…</p>;

  return method === "password" ? (
    <PasswordLogin onUseCode={() => setMethod("code")} />
  ) : (
    <CodeLogin onUsePassword={() => setMethod("password")} />
  );
}

/** E-mail, then a 6-digit code (or the link) by e-mail. Creates the account on first use. */
function CodeLogin({ onUsePassword }: { onUsePassword: () => void }) {
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
    if (!EMAIL.test(address)) return setError("Digite um e-mail válido, como voce@exemplo.com.");
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

  if (step === "code") {
    return (
      <form onSubmit={verify} noValidate className="grid gap-4">
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
            className={`${field} text-center font-mono text-[22px] font-semibold tracking-[0.3em]`}
          />
        </label>
        {error && <Alert>{error}</Alert>}
        <button type="submit" disabled={busy} className={primary}>
          {busy ? "Conferindo…" : "Entrar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setStep("email");
            setError(null);
          }}
          className={linkButton}
        >
          Usar outro e-mail ou pedir de novo
        </button>
        <p className="text-[13px] text-muted">Não chegou? Olhe a caixa de spam. Pode levar um ou dois minutos.</p>
      </form>
    );
  }

  return (
    <form onSubmit={sendEmail} noValidate className="grid gap-4">
      <p className="text-[14px] text-muted">
        Sem senha: a gente manda um código e um link para o seu e-mail. Se for a primeira vez, a conta é criada.
      </p>
      <EmailField />
      <ConsentField />
      {error && <Alert>{error}</Alert>}
      <button type="submit" disabled={busy} className={primary}>
        {busy ? "Enviando…" : "Receber código por e-mail"}
      </button>
      <Or />
      <button type="button" onClick={onUsePassword} className={secondary}>
        Entrar com senha
      </button>
    </form>
  );
}

/** E-mail and password: sign in, create an account, or get a link to set a new password. */
function PasswordLogin({ onUseCode }: { onUseCode: () => void }) {
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

    if (!EMAIL.test(email)) return setError("Digite um e-mail válido, como voce@exemplo.com.");
    if (mode === "signin" && !password) return setError("Digite sua senha.");
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
    <form onSubmit={submit} noValidate className="grid gap-4" key={mode}>
      {mode !== "signin" && (
        <p className="font-mono text-[15px] font-semibold tracking-[-0.045em]">
          {mode === "signup" ? "Criar conta com senha" : "Criar uma senha nova"}
        </p>
      )}
      <EmailField />
      {mode !== "forgot" && (
        <label className="block text-[14px] font-semibold">
          {mode === "signup" ? "Crie uma senha" : "Senha"}
          <input
            name="password"
            type="password"
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
            <input name="confirm" type="password" autoComplete="new-password" className={field} />
          </label>
          <ConsentField />
        </>
      )}
      {error && <Alert>{error}</Alert>}
      <button type="submit" disabled={busy} className={primary}>
        {busy ? "Aguarde…" : mode === "signin" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link para criar senha nova"}
      </button>
      <div className="flex flex-wrap justify-between gap-x-4">
        {mode === "signin" ? (
          <>
            <button type="button" onClick={() => switchTo("forgot")} className={linkButton}>
              Esqueci minha senha
            </button>
            <button type="button" onClick={() => switchTo("signup")} className={linkButton}>
              Criar conta
            </button>
          </>
        ) : (
          <button type="button" onClick={() => switchTo("signin")} className={linkButton}>
            Já tenho senha
          </button>
        )}
      </div>
      {mode === "signin" && (
        <>
          <Or />
          <button type="button" onClick={onUseCode} className={secondary}>
            Entrar com código por e-mail
          </button>
          <p className="text-[13px] text-muted">Sem senha? O código chega no seu e-mail e cria a conta se for a primeira vez.</p>
        </>
      )}
    </form>
  );
}
