import { getOpenOpportunities } from "@/lib/opportunities";
import type { Opportunity } from "@/lib/opportunity";

// Date-only values are stored as UTC midnight; formatting in UTC keeps the day intact.
const dateFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

function formatDate(isoDate: string): string {
  return dateFormat.format(new Date(`${isoDate.slice(0, 10)}T00:00:00Z`));
}

function HackathonCard({ item }: { item: Opportunity }) {
  const place = item.modality === "online" ? "Online" : (item.location.raw ?? "Presencial");

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="font-semibold leading-snug">{item.title}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {[item.organizer, place].filter(Boolean).join(" · ")}
        </p>
        <p className="text-sm">
          {item.registrationDeadline ? (
            <span className="font-medium">
              Inscrições até {formatDate(item.registrationDeadline)}
            </span>
          ) : (
            <span>Prazo não informado</span>
          )}
          {item.benefits.length > 0 && (
            <span className="text-zinc-600 dark:text-zinc-400"> · {item.benefits.join(", ")}</span>
          )}
        </p>
        {item.tags.length > 0 && (
          <p className="text-xs text-zinc-500">{item.tags.join(" · ")}</p>
        )}
        <p className="text-xs text-zinc-500">
          Verificado em {formatDate(item.verifiedAt)} · fonte: {item.source}
        </p>
      </div>
      <a
        href={item.officialUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-md bg-foreground px-4 py-2 text-center text-sm font-medium text-background hover:opacity-90"
      >
        Ver página oficial
      </a>
    </li>
  );
}

async function HackathonList() {
  const result = await getOpenOpportunities("hackathon");

  if (!result.configured) {
    return (
      <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        O banco de dados ainda não foi configurado. Defina NEXT_PUBLIC_SUPABASE_URL e
        NEXT_PUBLIC_SUPABASE_ANON_KEY.
      </p>
    );
  }

  if (result.items.length === 0) {
    return <p className="text-zinc-600 dark:text-zinc-400">Nenhum hackathon aberto no momento.</p>;
  }

  return (
    <>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {result.items.length} hackathons abertos, do prazo mais próximo ao mais distante.
      </p>
      <ul className="flex flex-col gap-3">
        {result.items.map((item) => (
          <HackathonCard key={`${item.source}:${item.sourceId}`} item={item} />
        ))}
      </ul>
    </>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Hackathons abertos</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Coletados do Devpost. Confira sempre as regras na página oficial antes de se inscrever.
        </p>
      </header>
      <HackathonList />
    </main>
  );
}
