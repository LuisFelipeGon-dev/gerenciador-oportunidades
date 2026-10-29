"use client";

import Link from "next/link";
import { useState } from "react";
import { deleteAccount, useSession } from "@/lib/account";

/** Ajustes › Conta: who is signed in and the dangerous action, away from quick menus. */
export function AccountSettings() {
  const session = useSession();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session === undefined) return <p className="mt-2 text-[14px] text-muted">Carregando…</p>;
  if (!session) {
    return (
      <p className="mt-2 text-[15px]">
        Você não entrou numa conta.{" "}
        <Link href="/entrar" className="font-semibold text-action underline-offset-2 hover:underline">
          Entrar
        </Link>{" "}
        leva seu perfil e seus salvos para o celular e o computador.
      </p>
    );
  }

  return (
    <>
      <p className="mt-2 text-[15px]">
        Conectado como <span className="font-semibold">{session.user.email}</span>
      </p>
      <div className="mt-5 rounded-2xl border border-line bg-card p-4">
        <h3 className="text-[15px] font-bold">Apagar minha conta</h3>
        <p className="mt-1 text-[14px] text-muted">Apaga a conta, o perfil e os salvos na hora. Não dá para desfazer.</p>
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="mt-3 rounded-lg border border-urgent/50 px-3.5 py-2 text-[14px] font-semibold text-urgent hover:bg-urgent-bg"
          >
            Apagar minha conta
          </button>
        ) : (
          <div className="mt-3 rounded-xl bg-urgent-bg p-3">
            <p className="text-[14px] font-semibold text-urgent">Tem certeza? Conta, perfil e salvos somem para sempre.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  const failure = await deleteAccount();
                  if (failure) setError("Não deu certo agora. Tente de novo.");
                }}
                className="rounded-lg bg-urgent px-3.5 py-2 text-[14px] font-bold text-card"
              >
                Apagar tudo
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-lg border border-line bg-card px-3.5 py-2 text-[14px] font-semibold hover:border-ink"
              >
                Cancelar
              </button>
            </div>
            {error && (
              <p role="alert" className="mt-2 text-[13.5px] font-semibold text-urgent">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
