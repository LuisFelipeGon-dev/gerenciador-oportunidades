"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut, useAlerts, useSession } from "@/lib/account";
import { ageOn, effectiveInterests, localToday, type Profile } from "@/lib/personalize";
import { TYPE_PLURAL } from "./format";
import { PencilIcon, PinIcon, SlidersIcon, XIcon } from "./icons";

const LEVEL_LABEL: Record<Profile["level"], string> = {
  high_school: "Ensino médio",
  undergraduate: "Graduação",
  graduate: "Pós-graduação",
  phd: "Doutorado",
};

const initialsOf = (p: Profile) => (p.name || p.course).slice(0, 2).toUpperCase();

/**
 * The profile pill in the top bar and what opens from it: the profile, Ajustes and the account.
 * A dropdown on wider screens, a sheet from the bottom on phones.
 */
export function ProfileMenu({ profile, onEditProfile }: { profile: Profile | null; onEditProfile: () => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const session = useSession();
  const alerts = useAlerts();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const editProfile = () => {
    setOpen(false);
    onEditProfile();
  };
  const p = profile;
  const interests = effectiveInterests(p) ?? [];

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex items-center gap-2 rounded-full bg-navy-2 p-1.5 text-[13.5px] hover:bg-white/15 sm:pr-3.5"
      >
        <span className="grid size-[26px] place-items-center rounded-full bg-sky text-[11px] font-extrabold text-navy">
          {p ? initialsOf(p) : <PencilIcon className="size-3.5" />}
        </span>
        {/* Phones only show the avatar: logo + "Entrar" + this pill must fit in 360px. */}
        <span className="sr-only sm:not-sr-only sm:max-w-[16ch] sm:truncate">{p ? `${p.course} · ${p.city}` : "Montar perfil"}</span>
      </button>

      {open && (
        <>
          <div aria-hidden="true" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-[rgba(9,20,48,0.45)] sm:hidden" />
          <div
            role="dialog"
            aria-label="Seu perfil e sua conta"
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-3xl border border-line bg-card text-ink shadow-[0_-12px_40px_rgb(var(--shadow-rgb)/0.25)] animate-[rise-in_.25s_cubic-bezier(.16,1,.3,1)] sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:bottom-auto sm:mt-2 sm:w-[360px] sm:rounded-2xl sm:shadow-[0_20px_48px_-16px_rgb(var(--shadow-rgb)/0.35)]"
          >
            <div className="flex items-center justify-between px-5 pt-4 sm:hidden">
              <span className="text-[15px] font-extrabold">Seu perfil</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="grid size-9 place-items-center rounded-full hover:bg-ground">
                <XIcon className="size-5" />
              </button>
            </div>

            <section className="px-5 pt-4 pb-5 sm:pt-5">
              {p ? (
                <>
                  <div className="flex items-center gap-3">
                    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-sky text-[15px] font-extrabold text-navy">
                      {initialsOf(p)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[16px] font-bold">{p.name || p.course}</p>
                      <p className="flex items-center gap-1 text-[13.5px] text-muted">
                        <PinIcon className="size-3.5 shrink-0" />
                        <span className="truncate">
                          {p.city}, {p.state}
                        </span>
                      </p>
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13.5px]">
                    {[
                      ["Curso", p.course],
                      ["Nível", LEVEL_LABEL[p.level]],
                      ["Idade", `${ageOn(p.birthDate, localToday())} anos`],
                      ["Perto de você", `até ${p.radiusKm} km`],
                      ...(alerts ? [["Resumo por e-mail", alerts.enabled ? "Ligado" : "Desligado"]] : []),
                    ].map(([label, value]) => (
                      <div key={label} className="min-w-0">
                        <dt className="text-[12px] font-semibold text-muted">{label}</dt>
                        <dd className="truncate font-semibold">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  {interests.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-1.5 text-[12.5px] font-semibold" aria-label="Interesses">
                      {interests.map((i) => (
                        <li key={i} className="rounded-full bg-sky-tint px-2.5 py-1">
                          {TYPE_PLURAL[i]}
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={editProfile}
                    className="mt-4 w-full rounded-xl bg-action py-2.5 text-[14.5px] font-bold text-card hover:bg-action-strong"
                  >
                    Editar perfil
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[16px] font-bold">Monte seu perfil</p>
                  <p className="mt-1 text-[14px] text-muted">Curso, cidade e nível: a página passa a mostrar só o que serve pra você.</p>
                  <button
                    type="button"
                    onClick={editProfile}
                    className="mt-4 w-full rounded-xl bg-action py-2.5 text-[14.5px] font-bold text-card hover:bg-action-strong"
                  >
                    Montar perfil
                  </button>
                </>
              )}
            </section>

            <nav className="border-t border-line px-2 py-2" aria-label="Mais opções">
              <Link
                href="/ajustes"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-semibold hover:bg-ground"
              >
                <SlidersIcon className="size-5 text-muted" />
                Ajustes
                <span className="ml-auto text-[13px] font-normal text-muted">tema, idioma, conta</span>
              </Link>
            </nav>

            <section className="border-t border-line px-5 py-4">
              {session ? (
                <div className="flex items-center gap-3">
                  <p className="min-w-0 flex-1 text-[13.5px] text-muted">
                    Conectado como <span className="block truncate font-semibold text-ink">{session.user.email}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      void signOut();
                    }}
                    className="shrink-0 rounded-lg border border-line px-3.5 py-2 text-[14px] font-semibold hover:border-ink"
                  >
                    Sair
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <p className="min-w-0 flex-1 text-[13.5px] text-muted">Leve perfil e salvos para o celular e o computador.</p>
                  <Link href="/entrar" className="shrink-0 rounded-lg border border-line px-3.5 py-2 text-[14px] font-semibold hover:border-ink">
                    Entrar
                  </Link>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
