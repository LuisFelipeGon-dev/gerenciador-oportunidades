import type { Metadata } from "next";
import Link from "next/link";
import { SimpleHeader } from "../_components/brand";
import { AccountSettings } from "./account-settings";
import { ThemePicker } from "./theme-picker";

export const metadata: Metadata = {
  title: "Ajustes",
};

export default function Page() {
  return (
    <div className="flex flex-1 flex-col">
      <SimpleHeader />
      <main className="mx-auto w-full max-w-[760px] px-4 py-10 sm:py-14">
        <Link href="/" className="text-[14px] font-semibold text-action">
          ← Voltar
        </Link>
        <h1 className="mt-4 text-[28px] leading-tight font-extrabold tracking-tight">Ajustes</h1>
        <p className="mt-1 text-[15px] text-muted">Tema, idioma e sua conta.</p>

        <section className="mt-8">
          <ThemePicker />
        </section>

        <section className="mt-10 border-t border-line pt-8">
          <h2 className="text-[17px] font-extrabold tracking-tight">Idioma</h2>
          <p className="mt-2 text-[15px]">Português (Brasil)</p>
          <p className="mt-1 text-[14px] text-muted">Por enquanto o site existe só em português.</p>
        </section>

        <section className="mt-10 border-t border-line pt-8">
          <h2 className="text-[17px] font-extrabold tracking-tight">Conta</h2>
          <AccountSettings />
        </section>
      </main>
    </div>
  );
}
