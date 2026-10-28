import { getOpenOpportunities, getPrograms } from "@/lib/opportunities";
import { Home } from "./_components/home";

export default async function Page() {
  const [items, programs] = await Promise.all([getOpenOpportunities(), getPrograms()]);

  if (!items.configured || !programs.configured) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <p className="rounded-2xl border border-line bg-card p-5 text-[15px]">
          O banco de dados ainda não foi configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.
        </p>
      </main>
    );
  }

  return <Home items={items.items} programs={programs.items} />;
}
