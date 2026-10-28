import type { Metadata } from "next";
import Link from "next/link";
import { ThemePicker } from "./theme-picker";

export const metadata: Metadata = {
  title: "Ajustes · Oportunidades para estudantes",
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
      <main className="mx-auto w-full max-w-[760px] px-4 py-10 sm:py-14">
        <Link href="/" className="text-[14px] font-semibold text-action">
          ← Voltar
        </Link>
        <h1 className="mt-4 text-[28px] leading-tight font-extrabold tracking-tight">Ajustes</h1>
        <p className="mt-1 text-[15px] text-muted">Como o site aparece pra você.</p>

        <section className="mt-8">
          <ThemePicker />
        </section>

        <section className="mt-10 border-t border-line pt-8">
          <h2 className="text-[17px] font-extrabold tracking-tight">Idioma</h2>
          <p className="mt-2 text-[15px]">Português (Brasil)</p>
          <p className="mt-1 text-[14px] text-muted">Por enquanto o site existe só em português.</p>
        </section>
      </main>
    </div>
  );
}
