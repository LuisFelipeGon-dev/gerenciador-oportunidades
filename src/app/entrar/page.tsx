import type { Metadata } from "next";
import Link from "next/link";
import { SimpleHeader } from "../_components/brand";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar",
};

export default function Page() {
  return (
    <div className="flex flex-1 flex-col">
      <SimpleHeader />
      <main className="mx-auto w-full max-w-[440px] px-4 py-10 sm:py-14">
        <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">Entrar</h1>
        <p className="mt-2 text-[15px] text-muted">
          Com a conta, seu perfil e seus salvos acompanham você no celular e no computador.
        </p>
        <div className="mt-6 rounded-2xl border border-line bg-card p-5 sm:p-6">
          <LoginForm />
        </div>
        <Link href="/" className="mt-5 inline-block text-[14px] font-semibold text-action">
          Voltar sem entrar
        </Link>
      </main>
    </div>
  );
}
