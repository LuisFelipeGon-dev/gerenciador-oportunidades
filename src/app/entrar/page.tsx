import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar · Oportunidades para estudantes",
};

export default function Page() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="on-navy bg-navy text-white">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center px-4 sm:px-5">
          <Link href="/" className="flex items-center gap-2 text-[19px] font-extrabold tracking-tight">
            <span aria-hidden="true" className="relative inline-block size-[22px] rounded-md bg-sky">
              <span className="absolute inset-1.5 rounded-full bg-navy" />
            </span>
            oportunidades
          </Link>
        </div>
      </div>
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
