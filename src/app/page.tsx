import { getAmbassadorPrograms, getOpenOpportunities } from "@/lib/opportunities";
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
  curated: "página oficial, conferida à mão",
};

const monthFormat = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });
const listFormat = new Intl.ListFormat("pt-BR", { type: "disjunction" });

function monthNames(months: number[]): string {
  return listFormat.format(months.map((m) => monthFormat.format(new Date(Date.UTC(2000, m - 1, 1)))));
}

const LEVEL_LABELS: Record<string, string> = {
  undergraduate: "graduação",
  graduate: "pós-graduação",
  phd: "doutorado",
};

function programStatus(item: Opportunity): string {
  if (item.status === "open") {
    return item.registrationDeadline
      ? `Inscrições abertas até ${formatDate(item.registrationDeadline)}`
      : "Inscrições abertas";
  }
  if (item.status === "upcoming") return "Abre em breve";
  return item.typicalOpenMonths.length > 0
    ? `Fechado · costuma abrir em ${monthNames(item.typicalOpenMonths)}`
    : "Fechado no momento";
}

function eligibilityLine(item: Opportunity): string | null {
  const { minAge, studentsOnly, levels } = item.eligibility;
  const parts = [
    minAge ? `${minAge}+ anos` : null,
    studentsOnly && levels?.length
      ? `estudantes de ${levels.map((l) => LEVEL_LABELS[l] ?? l).join(", ")}`
      : studentsOnly
        ? "só estudantes"
        : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

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
        <h3 className="font-semibold leading-snug">{item.title}</h3>
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

function ProgramCard({ item }: { item: Opportunity }) {
  const eligibility = eligibilityLine(item);
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="font-semibold leading-snug">{item.title}</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{item.organizer}</p>
        <p
          className={`text-sm font-medium ${item.status === "open" ? "text-emerald-700 dark:text-emerald-400" : ""}`}
        >
          {programStatus(item)}
        </p>
        {eligibility && <p className="text-sm text-zinc-600 dark:text-zinc-400">{eligibility}</p>}
        {item.benefits.length > 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{item.benefits.join(" · ")}</p>
        )}
        {item.note && <p className="text-xs text-amber-800 dark:text-amber-300">{item.note}</p>}
        <p className="text-xs text-zinc-500">
          Verificado em {formatDate(item.verifiedAt)} · fonte: {SOURCE_LABELS[item.source] ?? item.source}
        </p>
      </div>
      <a
        href={item.officialUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-md border border-zinc-300 px-4 py-2 text-center text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        Ver página oficial
      </a>
    </li>
  );
}

async function ProgramList() {
  const result = await getAmbassadorPrograms();
  if (!result.configured || result.items.length === 0) return null;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="programas">
      <div className="flex flex-col gap-1">
        <h2 id="programas" className="text-xl font-semibold tracking-tight">
          Programas de embaixador
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Programas anuais de empresas para estudantes. Os fechados mostram quando costumam abrir.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {result.items.map((item) => (
          <ProgramCard key={`${item.source}:${item.sourceId}`} item={item} />
        ))}
      </ul>
    </section>
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
      <ProgramList />
      <section className="flex flex-col gap-3" aria-labelledby="abertas">
        <h2 id="abertas" className="text-xl font-semibold tracking-tight">
          Hackathons e eventos
        </h2>
        <OpportunityList />
      </section>
    </main>
  );
}
