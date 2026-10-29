"use client";

import Link from "next/link";
import { useSession } from "@/lib/account";
import { NewPasswordForm } from "../../_components/new-password-form";

/**
 * Opened from the "Esqueci minha senha" e-mail. The browser client exchanges the code in the URL
 * for a session (same browser that asked, PKCE); with it, the person sets the new password.
 */
export function ResetPassword() {
  const session = useSession();

  if (session === undefined) return <p className="text-[15px] text-muted">Conferindo o link…</p>;
  if (!session) {
    return (
      <div className="grid gap-3">
        <p className="text-[15px]">
          Este link venceu, já foi usado ou foi aberto em outro navegador. Peça outro em{" "}
          <Link href="/entrar" className="font-semibold text-action underline-offset-2 hover:underline">
            Entrar
          </Link>{" "}
          › Senha › Esqueci minha senha, e abra o e-mail no mesmo navegador.
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="mb-4 text-[15px]">
        Conta: <strong>{session.user.email}</strong>
      </p>
      <NewPasswordForm submitLabel="Salvar senha" doneMessage="Senha criada. Da próxima vez, é só entrar com o e-mail e a senha." />
      <Link href="/" className="mt-5 inline-block text-[14px] font-semibold text-action">
        Ir para o Topa?
      </Link>
    </>
  );
}
