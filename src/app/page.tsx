import { getOpenOpportunities } from "@/lib/opportunities";
import type { Opportunity, OpportunityType } from "@/lib/opportunity";

// Date-only values are stored as UTC midnight; formatting in UTC keeps the day intact.
const dateFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

function formatDate(isoDate: string): string {
  return dateFormat.format(new Date(`${isoDate.slice(0, 10)}T00:00:00Z`));
}

const TYPE_LABELS: Record<OpportunityType, string> = {
  hackathon: "Hackathon",
  ambassador: "Embaixador",
  event: "Evento",
  scholarship: "Bolsa",
  internship: "Estágio",
};

const SOURCE_LABELS: Record<string, string> = {
  devpost: "Devpost",
  mlh: "MLH",
  gdg: "GDG",
};

function placeOf(item: Opportunity): string {
  if (item.modality === "online") return "Online";
  const { city, state, country, raw } = item.location;
  const where = city ? [city, country === "BR" ? state : country].filter(Boolean).join(", ") : raw;
  const label = where ?? "Presencial";
  return item.modality === "hybrid" ? `${label} (híbrido)` : label;
}

function dateLine(item: Opportunity): string {
  if (item.registrationDeadline) return `Inscrições até ${formatDate(item.registrationDeadline)}`;
  if (item.startsOn && item.endsOn && item.endsOn !== item.startsOn) {
    return `De ${formatDate(item.startsOn)} a ${formatDate(item.endsOn)}`;
  }
  if (item.startsOn) return `Em ${formatDate(item.startsOn)}`;
  return "Data não informada";
}

function OpportunityCard({ item }: { item: Opportunity }) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {TYPE_LABELS[item.type]}
        </p>
        <h2 className="font-semibold leading-snug">{item.title}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {[item.organizer, placeOf(item)].filter(Boolean).join(" · ")}
        </p>
        <p className="text-sm">
          <span className="font-medium">{dateLine(item)}</span>
          {item.benefits.length > 0 && (
            <span className="text-zinc-600 dark:text-zinc-400"> · {item.benefits.join(", ")}</span>
          )}
        </p>
        {item.tags.length > 0 && <p className="text-xs text-zinc-500">{item.tags.join(" · ")}</p>}
        <p className="text-xs text-zinc-500">
          Verificado em {formatDate(item.verifiedAt)} · fonte: {SOURCE_LABELS[item.source] ?? item.source}
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

async function OpportunityList() {
  const result = await getOpenOpportunities();

  if (!result.configured) {
    return (
      <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        O banco de dados ainda não foi configurado. Defina NEXT_PUBLIC_SUPABASE_URL e
        NEXT_PUBLIC_SUPABASE_ANON_KEY.
      </p>
    );
  }

  if (result.items.length === 0) {
    return <p className="text-zinc-600 dark:text-zinc-400">Nenhuma oportunidade aberta no momento.</p>;
  }

  return (
    <>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {result.items.length} oportunidades abertas, da data mais próxima à mais distante.
      </p>
      <ul className="flex flex-col gap-3">
        {result.items.map((item) => (
          <OpportunityCard key={`${item.source}:${item.sourceId}`} item={item} />
        ))}
      </ul>
    </>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Oportunidades abertas</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Hackathons do Devpost e da MLH e eventos dos GDGs brasileiros. Confira sempre as regras na
          página oficial antes de se inscrever.
        </p>
      </header>
      <OpportunityList />
    </main>
  );
}
