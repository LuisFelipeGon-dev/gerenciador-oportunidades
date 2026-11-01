import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getOpenOpportunities, getOpportunity, getPrograms } from "@/lib/opportunities";
import type { Opportunity } from "@/lib/opportunity";
import { opportunityPath, sourceIdFromSegment } from "@/lib/program-alerts";
import { SimpleHeader } from "../../../_components/brand";
import { MODALITY_LABEL, TYPE_LABEL, placeLine } from "../../../_components/format";
import { OpportunityView } from "./opportunity-view";

// Each opportunity's own page. Shared links point here, so WhatsApp and Instagram show the
// title, the deadline and the preview image (opengraph-image.tsx) instead of the site's.

// Reached from shared links rather than in-app navigation, and an unknown id must answer a real
// 404: rendering waits for the item instead of streaming a shell around it.
export const instant = false;

/** Programs and the next open items are built ahead; any other id renders on its first visit. */
export async function generateStaticParams() {
  const [items, programs] = await Promise.all([getOpenOpportunities(), getPrograms()]);
  const list: Opportunity[] = [...(programs.configured ? programs.items : []), ...(items.configured ? items.items.slice(0, 40) : [])];
  const params = list.map((o) => {
    const [, source, id] = opportunityPath(o).split("/").slice(1);
    return { source: decodeURIComponent(source), id: decodeURIComponent(id) };
  });
  // Cache Components needs at least one sample, even before the database is configured.
  return params.length > 0 ? params : [{ source: "curated", id: "claude-campus" }];
}

async function load(params: PageProps<"/o/[source]/[id]">["params"]): Promise<Opportunity | null> {
  const { source, id } = await params;
  const found = await getOpportunity(source, sourceIdFromSegment(id));
  return found.configured ? found.item : null;
}

function deadlineText(o: Opportunity): string {
  const date = o.registrationDeadline ?? o.startsOn;
  const dm = date ? `${date.slice(8, 10)}/${date.slice(5, 7)}` : null;
  if (o.registrationDeadline) return `Inscrições até ${dm}`;
  if (o.startsOn) return `Acontece em ${dm}`;
  return o.status === "open" ? "Inscrições abertas" : "Inscrições fechadas no momento";
}

export async function generateMetadata({ params }: PageProps<"/o/[source]/[id]">): Promise<Metadata> {
  const o = await load(params);
  if (!o) return { title: "Oportunidade não encontrada" };
  const description = [
    `${TYPE_LABEL[o.type]} ${MODALITY_LABEL[o.modality].toLowerCase()}${o.modality === "online" ? "" : ` em ${placeLine(o)}`}`,
    deadlineText(o),
    o.benefits[0],
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    title: o.title,
    description,
    alternates: { canonical: opportunityPath(o) },
    openGraph: { title: o.title, description, type: "article", siteName: "Topa?", locale: "pt_BR" },
    twitter: { card: "summary_large_image", title: o.title, description },
  };
}

export default async function Page({ params }: PageProps<"/o/[source]/[id]">) {
  const o = await load(params);
  if (!o) notFound();
  return (
    <>
      <SimpleHeader />
      <OpportunityView o={o} />
    </>
  );
}
