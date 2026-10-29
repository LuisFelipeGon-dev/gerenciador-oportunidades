import type { Metadata } from "next";
import { SimpleHeader } from "../../_components/brand";
import { ResetPassword } from "./reset-password";

export const metadata: Metadata = {
  title: "Criar senha nova",
  robots: { index: false },
};

export default function Page() {
  return (
    <div className="flex flex-1 flex-col">
      <SimpleHeader />
      <main className="mx-auto w-full max-w-[440px] px-4 py-10 sm:py-14">
        <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">Criar senha nova</h1>
        <div className="mt-6 rounded-2xl border border-line bg-card p-5 sm:p-6">
          <ResetPassword />
        </div>
      </main>
    </div>
  );
}
