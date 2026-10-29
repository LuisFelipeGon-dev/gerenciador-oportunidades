import type { Metadata } from "next";
import { SimpleHeader } from "../../_components/brand";
import { Unsubscribe } from "./unsubscribe";

export const metadata: Metadata = {
  title: "Parar o resumo por e-mail",
  robots: { index: false },
};

export default function Page() {
  return (
    <div className="flex flex-1 flex-col">
      <SimpleHeader />
      <main className="mx-auto w-full max-w-[560px] px-4 py-10 sm:py-14">
        <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">Resumo por e-mail</h1>
        <Unsubscribe />
      </main>
    </div>
  );
}
