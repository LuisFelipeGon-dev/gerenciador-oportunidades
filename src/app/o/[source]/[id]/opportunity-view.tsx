"use client";

import Link from "next/link";
import { toggleSaved, toggleWatch, useSession } from "@/lib/account";
import { useProfile, useSaved, useWatching } from "@/lib/local-store";
import type { Opportunity } from "@/lib/opportunity";
import { itemKey, localToday } from "@/lib/personalize";
import type { CardActions } from "../../../_components/cards";
import { DetailContent } from "../../../_components/detail-drawer";
import { ChevronLeftIcon } from "../../../_components/icons";

/** The item's own page: the drawer's content, personalized once the browser reads the profile. */
export function OpportunityView({ o }: { o: Opportunity }) {
  const profile = useProfile();
  const savedKeys = useSaved();
  const watchingKeys = useWatching();
  const session = useSession();
  const hydrated = profile !== undefined;

  const actions: CardActions = {
    onOpen: () => {},
    onToggleSave: (x) => void toggleSaved(itemKey(x)),
    isSaved: (x) => savedKeys.includes(itemKey(x)),
    isWatching: (x) => watchingKeys.includes(itemKey(x)),
    onToggleWatch: (x) => void toggleWatch(itemKey(x)),
  };

  return (
    <main id="conteudo" className="mx-auto w-full max-w-[720px] px-4 pt-6 pb-16 sm:px-5 sm:pt-10">
      <Link
        href="/"
        className="mb-4 inline-flex min-h-11 items-center gap-1 font-mono text-[13px] font-semibold tracking-tight text-action underline-offset-4 hover:underline"
      >
        <ChevronLeftIcon className="size-4" />
        Ver todas as oportunidades
      </Link>
      <article className="overflow-hidden rounded-lg border border-line bg-card">
        <DetailContent o={o} today={hydrated ? localToday() : null} profile={profile ?? null} actions={actions} signedIn={!!session} titleAs="h1" />
      </article>
    </main>
  );
}
