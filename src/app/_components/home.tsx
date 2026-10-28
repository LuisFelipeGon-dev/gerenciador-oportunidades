"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { regionOf, stateName } from "@/lib/brazil";
import { toggleSaved, useProfile, useSaved } from "@/lib/local-store";
import type { Opportunity, OpportunityType } from "@/lib/opportunity";
import { buildSections, isExcluded, itemKey, keyDate, localToday, type Profile } from "@/lib/personalize";
import { CompactRow, OpportunityCard, ProgramCard, type CardActions } from "./cards";
import { DetailDrawer } from "./detail-drawer";
import { TYPE_PLURAL, dateStub, shortDate } from "./format";
import { PencilIcon, PinIcon } from "./icons";
import { ProfileForm } from "./profile-form";

type Tab = "for-you" | "hackathon" | "event" | "ambassador";
const TABS: { id: Tab; label: string }[] = [
  { id: "for-you", label: "Para você" },
  { id: "hackathon", label: TYPE_PLURAL.hackathon },
  { id: "event", label: TYPE_PLURAL.event },
  { id: "ambassador", label: TYPE_PLURAL.ambassador },
];

// The open item lives in the URL hash (#o=source:id): shareable, and "back" closes it.
function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}
const readHash = () => window.location.hash;

function openItem(o: Opportunity) {
  window.location.hash = `o=${itemKey(o)}`;
}
function closeItem() {
  if (!window.location.hash) return;
  history.replaceState(null, "", window.location.pathname + window.location.search);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function SectionHeader({ title, count, hint }: { title: string; count?: number; hint?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      <h2 className="text-[19px] font-extrabold tracking-tight">{title}</h2>
      {count !== undefined && (
        <span className="rounded-full bg-ink px-2 py-0.5 text-[12px] font-bold text-white tabular-nums">{count}</span>
      )}
      {hint && <p className="w-full text-[13.5px] text-muted sm:w-auto">{hint}</p>}
    </div>
  );
}

function ShowMore({ total, shown, onMore }: { total: number; shown: number; onMore: () => void }) {
  if (shown >= total) return null;
  return (
    <button
      type="button"
      onClick={onMore}
      className="mt-1 w-full rounded-xl border border-line bg-card py-2.5 text-[14px] font-bold text-action hover:border-action"
    >
      Mostrar mais {Math.min(total - shown, 10)} de {total - shown}
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line bg-card px-4 py-5 text-[14px] text-muted">{children}</p>;
}

export function Home({ items, programs }: { items: Opportunity[]; programs: Opportunity[] }) {
  const profile = useProfile();
  const hydrated = profile !== undefined;
  const p: Profile | null = profile ?? null;
  const savedKeys = useSaved();
  const hash = useSyncExternalStore(subscribeHash, readHash, () => "");
  const [tab, setTab] = useState<Tab>("for-you");
  const [modeFilter, setModeFilter] = useState<"all" | "online" | "in_person">("all");
  const [profileOpen, setProfileOpen] = useState(false);
  const [limits, setLimits] = useState<Record<string, number>>({});

  const today = hydrated ? localToday() : null;
  const all = useMemo(() => [...items, ...programs], [items, programs]);
  const byKey = useMemo(() => new Map(all.map((o) => [itemKey(o), o])), [all]);
  const openKey = hash.startsWith("#o=") ? decodeURIComponent(hash.slice(3)) : null;
  const opened = openKey ? (byKey.get(openKey) ?? null) : null;

  const sections = useMemo(
    () => buildSections(items, programs, p, today ?? "1970-01-01"),
    [items, programs, p, today],
  );
  const saved = savedKeys.map((k) => byKey.get(k)).filter((o): o is Opportunity => !!o);

  const actions: CardActions = {
    onOpen: openItem,
    onToggleSave: (o) => toggleSaved(itemKey(o)),
    isSaved: (o) => savedKeys.includes(itemKey(o)),
  };

  const limit = (id: string, base: number) => limits[id] ?? base;
  const more = (id: string, base: number) => setLimits((l) => ({ ...l, [id]: (l[id] ?? base) + 10 }));

  const openPrograms = sections.programs.filter((o) => o.status === "open").length;
  const matching = new Set([...sections.nearby, ...sections.online].map(itemKey)).size + openPrograms;
  const nearbyWhere =
    p && sections.nearbyScope === "state"
      ? `em ${p.state}`
      : p && sections.nearbyScope === "region"
        ? `no ${regionOf(p.state)}`
        : "no Brasil";

  const timeline = (saved.length > 0 ? saved : [...sections.closingSoon, ...sections.nearby])
    .filter((o) => keyDate(o) && (!today || keyDate(o)! >= today))
    .sort((a, b) => keyDate(a)!.localeCompare(keyDate(b)!))
    .slice(0, 6);

  const tabItems =
    tab === "for-you"
      ? []
      : (tab === "ambassador" ? sections.programs : items.filter((o) => o.type === tab && !isExcluded(o, p)))
          .filter((o) => modeFilter === "all" || (modeFilter === "online" ? o.modality === "online" : o.modality !== "online"))
          .sort((a, b) => (keyDate(a) ?? "9999").localeCompare(keyDate(b) ?? "9999"));

  return (
    <>
      <div className="on-navy bg-navy text-white">
        <div className="mx-auto max-w-[1180px] px-4 sm:px-5">
          <nav className="flex h-16 items-center gap-5" aria-label="Principal">
            <Link href="/" onClick={() => setTab("for-you")} className="flex items-center gap-2 text-[19px] font-extrabold tracking-tight">
              <span aria-hidden="true" className="relative inline-block size-[22px] rounded-md bg-sky">
                <span className="absolute inset-1.5 rounded-full bg-navy" />
              </span>
              oportunidades
            </Link>
            <div className="hidden gap-5 text-[14.5px] font-medium md:flex">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  aria-current={tab === t.id ? "page" : undefined}
                  className={`-mb-[22px] border-b-2 pb-5 ${tab === t.id ? "border-sky font-semibold text-white" : "border-transparent text-navy-text hover:text-white"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="ml-auto flex items-center gap-2 rounded-full bg-navy-2 py-1.5 pr-3.5 pl-1.5 text-[13.5px] hover:bg-white/15"
            >
              <span className="grid size-[26px] place-items-center rounded-full bg-sky text-[11px] font-extrabold text-navy">
                {p?.name ? p.name.slice(0, 2).toUpperCase() : <PencilIcon className="size-3.5" />}
              </span>
              {p ? <span className="max-w-[16ch] truncate">{`${p.course} · ${p.city}`}</span> : "Montar perfil"}
            </button>
          </nav>

          <div className="grid gap-6 pt-7 pb-7 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              {p ? (
                <h1 className="max-w-[22ch] text-[28px] leading-[1.12] font-extrabold tracking-tight text-balance sm:text-[34px]">
                  {p.name ? `${greeting()}, ${p.name}. ` : ""}Tem <span className="text-sky">{matching} oportunidades</span> abertas que
                  combinam com você.
                </h1>
              ) : (
                <h1 className="max-w-[22ch] text-[28px] leading-[1.12] font-extrabold tracking-tight text-balance sm:text-[34px]">
                  Hackathons, eventos e programas <span className="text-sky">abertos pra estudantes</span>, num só lugar.
                </h1>
              )}
              <p className="mt-2 max-w-[60ch] text-[15px] text-navy-text">
                {p
                  ? `Montado a partir do seu perfil: ${p.course}, ${p.city} (${p.state}). Tudo leva à página oficial.`
                  : "Monte seu perfil em 30 segundos e a página passa a mostrar o que serve pra você: perto da sua cidade, no seu nível, no prazo."}
              </p>
              {hydrated && !p && (
                <button
                  type="button"
                  onClick={() => setProfileOpen(true)}
                  className="mt-4 rounded-xl bg-sky px-5 py-3 text-[15px] font-bold text-navy hover:bg-white"
                >
                  Montar meu perfil
                </button>
              )}
            </div>
            {hydrated && (
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { n: sections.closingSoon.length, l: "fecham nesta semana", c: "text-[#ff9b8f]" },
                  { n: sections.nearby.length, l: `presenciais ${nearbyWhere}`, c: "text-sky" },
                  { n: sections.online.length, l: "online pra você", c: "" },
                  { n: openPrograms, l: "programas abertos", c: "" },
                ].map((s) => (
                  <div key={s.l} className="flex flex-col-reverse rounded-xl bg-navy-2 px-3.5 py-3 sm:min-w-[120px]">
                    <dt className="mt-1 text-[12.5px] text-navy-text">{s.l}</dt>
                    <dd className={`text-[26px] leading-none font-extrabold tracking-tight tabular-nums ${s.c}`}>{s.n}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          <div className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-3 md:hidden" role="group" aria-label="Seções">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-[14px] font-semibold ${tab === t.id ? "bg-sky text-navy" : "bg-navy-2 text-navy-text"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-[1180px] gap-7 px-4 pt-6 pb-16 sm:px-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <main className="min-w-0">
          {!hydrated ? (
            <p className="text-muted">Carregando oportunidades…</p>
          ) : tab === "for-you" ? (
            <>
              {saved.length > 0 && (
                <section className="mb-9">
                  <SectionHeader title="Salvos" count={saved.length} hint="guardados neste navegador" />
                  <ul className="overflow-hidden rounded-2xl border border-line bg-card">
                    {saved.map((o) => (
                      <CompactRow key={itemKey(o)} o={o} today={today} actions={actions} />
                    ))}
                  </ul>
                </section>
              )}

              <section className="mb-9">
                <SectionHeader title="Fecha esta semana" count={sections.closingSoon.length} hint="inscrições que encerram nos próximos 7 dias" />
                {sections.closingSoon.length === 0 ? (
                  <Empty>Nada fechando nos próximos 7 dias. Bom momento pra olhar com calma o resto.</Empty>
                ) : (
                  <div className="grid gap-3">
                    {sections.closingSoon.slice(0, limit("soon", 3)).map((o) => (
                      <OpportunityCard key={itemKey(o)} o={o} today={today} profile={p} actions={actions} />
                    ))}
                    <ShowMore total={sections.closingSoon.length} shown={limit("soon", 3)} onMore={() => more("soon", 3)} />
                  </div>
                )}
              </section>

              <section className="mb-9">
                <SectionHeader
                  title={
                    p && sections.nearbyScope === "state"
                      ? `Perto de você · ${stateName(p.state)}`
                      : p && sections.nearbyScope === "region"
                        ? `Na sua região · ${regionOf(p.state)}`
                        : "Presenciais no Brasil"
                  }
                  count={sections.nearby.length}
                  hint={
                    p && sections.nearbyScope === "state"
                      ? "primeiro no seu estado, depois na sua região"
                      : p && sections.nearbyScope === "region"
                        ? `nada presencial em ${p.state} agora; estes são os mais perto`
                        : p
                          ? "nada presencial na sua região agora"
                          : "monte seu perfil para ver o que está perto de você"
                  }
                />
                {sections.nearby.length === 0 ? (
                  <Empty>Nenhum evento presencial no Brasil com data marcada agora.</Empty>
                ) : (
                  <div className="grid gap-3">
                    {sections.nearby.slice(0, limit("near", 4)).map((o) => (
                      <OpportunityCard
                        key={itemKey(o)}
                        o={o}
                        today={today}
                        profile={p}
                        actions={actions}
                        why={
                          p && o.location.state === p.state
                            ? `Aparece pra você porque é em ${p.state}, o seu estado.`
                            : undefined
                        }
                      />
                    ))}
                    <ShowMore total={sections.nearby.length} shown={limit("near", 4)} onMore={() => more("near", 4)} />
                  </div>
                )}
              </section>

              <section className="mb-9">
                <SectionHeader title="Online e aberto pra você" count={sections.online.length} hint="de onde você estiver" />
                {sections.online.length === 0 ? (
                  <Empty>Nenhuma oportunidade online combina com o seu perfil agora.</Empty>
                ) : (
                  <>
                    <ul className="overflow-hidden rounded-2xl border border-line bg-card">
                      {sections.online.slice(0, limit("online", 8)).map((o) => (
                        <CompactRow key={itemKey(o)} o={o} today={today} actions={actions} />
                      ))}
                    </ul>
                    <ShowMore total={sections.online.length} shown={limit("online", 8)} onMore={() => more("online", 8)} />
                  </>
                )}
              </section>

              {sections.programs.length > 0 && (
                <section>
                  <SectionHeader title="Programas pra ficar de olho" count={sections.programs.length} hint="abrem uma vez por ano; os fechados mostram quando costumam abrir" />
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {sections.programs.map((o) => (
                      <ProgramCard key={itemKey(o)} o={o} actions={actions} />
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            <section>
              <SectionHeader title={TYPE_PLURAL[tab as OpportunityType]} count={tabItems.length} hint="da data mais próxima à mais distante" />
              {tab !== "ambassador" && (
                <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Modalidade">
                  {(
                    [
                      { id: "all", l: "Tudo" },
                      { id: "online", l: "Online" },
                      { id: "in_person", l: "Presencial" },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={modeFilter === f.id}
                      onClick={() => setModeFilter(f.id)}
                      className={`rounded-lg border px-3 py-1.5 text-[13.5px] font-semibold ${modeFilter === f.id ? "border-ink bg-ink text-white" : "border-line bg-card hover:border-ink"}`}
                    >
                      {f.l}
                    </button>
                  ))}
                </div>
              )}
              {tabItems.length === 0 ? (
                <Empty>Nada aberto aqui agora.</Empty>
              ) : tab === "ambassador" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {tabItems.map((o) => (
                    <ProgramCard key={itemKey(o)} o={o} actions={actions} />
                  ))}
                </div>
              ) : (
                <div className="grid gap-3">
                  {tabItems.slice(0, limit(tab, 12)).map((o) => (
                    <OpportunityCard key={itemKey(o)} o={o} today={today} profile={p} actions={actions} />
                  ))}
                  <ShowMore total={tabItems.length} shown={limit(tab, 12)} onMore={() => more(tab, 12)} />
                </div>
              )}
            </section>
          )}
        </main>

        <aside className="grid gap-4 lg:sticky lg:top-4">
          <div className="rounded-2xl border border-line bg-card p-4">
            <h2 className="mb-3 text-[15px] font-extrabold">Seu perfil</h2>
            {p ? (
              <>
                <div className="mb-3 flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-full bg-sky font-extrabold text-navy">
                    {(p.name || p.course).slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-[15px] font-bold">{p.name || p.course}</p>
                    <p className="flex items-center gap-1 text-[13px] text-muted">
                      <PinIcon className="size-3.5" />
                      {p.city}, {p.state}
                    </p>
                  </div>
                </div>
                <ul className="flex flex-wrap gap-1.5 text-[12.5px] font-semibold">
                  {[
                    p.course,
                    { high_school: "Ensino médio", undergraduate: "Graduação", graduate: "Pós-graduação", phd: "Doutorado" }[p.level],
                    p.adult ? "18+" : "Menor de 18",
                    ...(p.interests.length ? p.interests.map((i) => TYPE_PLURAL[i]) : ["Todos os tipos"]),
                  ].map((t) => (
                    <li key={t} className="rounded-md bg-ground px-2 py-1">
                      {t}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-[14px] text-muted">
                Diga seu curso, cidade e nível para a página separar o que serve pra você.
              </p>
            )}
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="mt-4 w-full rounded-xl bg-navy py-2.5 text-[14px] font-bold text-white hover:bg-navy-2"
            >
              {p ? "Editar perfil" : "Montar perfil"}
            </button>
          </div>

          {hydrated && timeline.length > 0 && (
            <div className="rounded-2xl border border-line bg-card p-4">
              <h2 className="mb-2 text-[15px] font-extrabold">{saved.length > 0 ? "Prazos dos seus salvos" : "Próximos prazos"}</h2>
              <ul>
                {timeline.map((o) => {
                  const stub = dateStub(o, today);
                  return (
                    <li key={itemKey(o)} className="border-t border-line first:border-t-0">
                      <button
                        type="button"
                        onClick={() => openItem(o)}
                        className="grid w-full grid-cols-[52px_1fr] items-center gap-2.5 py-2 text-left text-[13.5px] hover:underline"
                      >
                        <span
                          className={`rounded-lg py-1 text-center text-[13px] font-extrabold tabular-nums ${stub.urgent ? "bg-urgent-bg text-urgent" : "bg-ground"}`}
                        >
                          {shortDate(keyDate(o)!)}
                        </span>
                        <span className="line-clamp-2">{o.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <p className="rounded-2xl border border-line bg-card p-4 text-[12.5px] leading-relaxed text-muted">
            Coletado todo dia do Devpost, da MLH, dos GDGs brasileiros e de páginas oficiais conferidas à mão. O site nunca é a
            fonte final: confira as regras na página oficial.
          </p>
        </aside>
      </div>

      {today && <DetailDrawer o={opened} today={today} profile={p} actions={actions} onClose={closeItem} />}
      <ProfileForm open={profileOpen} initial={p} onClose={() => setProfileOpen(false)} />
    </>
  );
}
