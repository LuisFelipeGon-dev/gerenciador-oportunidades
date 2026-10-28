import type { Metadata } from "next";
import Link from "next/link";
import { Unsubscribe } from "./unsubscribe";

export const metadata: Metadata = {
  title: "Parar o resumo por e-mail · Oportunidades para estudantes",
  robots: { index: false },
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
      <main className="mx-auto w-full max-w-[560px] px-4 py-10 sm:py-14">
        <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">Resumo por e-mail</h1>
        <Unsubscribe />
      </main>
    </div>
  );
}
