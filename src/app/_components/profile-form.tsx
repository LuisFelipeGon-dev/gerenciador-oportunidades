"use client";

import { useEffect, useRef, useState } from "react";
import { STATES, isUF } from "@/lib/brazil";
import { saveProfile } from "@/lib/local-store";
import type { OpportunityType } from "@/lib/opportunity";
import type { Level, Profile } from "@/lib/personalize";
import { XIcon } from "./icons";

const LEVEL_OPTIONS: { value: Level; label: string }[] = [
  { value: "high_school", label: "Ensino médio" },
  { value: "undergraduate", label: "Graduação" },
  { value: "graduate", label: "Pós-graduação ou mestrado" },
  { value: "phd", label: "Doutorado" },
];

const INTEREST_OPTIONS: { value: OpportunityType; label: string }[] = [
  { value: "hackathon", label: "Hackathons" },
  { value: "event", label: "Eventos e palestras" },
  { value: "ambassador", label: "Programas de embaixador" },
];

const COURSES = [
  "Administração", "Arquitetura e Urbanismo", "Biologia", "Ciência da Computação", "Ciências Contábeis",
  "Design", "Direito", "Economia", "Educação Física", "Enfermagem", "Engenharia Civil", "Engenharia de Computação",
  "Engenharia de Software", "Engenharia Elétrica", "Engenharia Mecânica", "Farmácia", "Física", "Jornalismo",
  "Letras", "Matemática", "Medicina", "Nutrição", "Pedagogia", "Psicologia", "Publicidade e Propaganda",
  "Química", "Relações Internacionais", "Sistemas de Informação",
];

const field = "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-[15px] focus:border-action focus:outline-none";

export function ProfileForm({ open, initial, onClose }: { open: boolean; initial: Profile | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const state = String(data.get("state") ?? "");
    const course = String(data.get("course") ?? "").trim();
    const city = String(data.get("city") ?? "").trim();
    const level = String(data.get("level") ?? "") as Level;
    if (!course || !city || !isUF(state) || !LEVEL_OPTIONS.some((l) => l.value === level)) {
      setError("Preencha curso, cidade, estado e nível de estudo.");
      return;
    }
    saveProfile({
      name: String(data.get("name") ?? "").trim(),
      course,
      city,
      state,
      level,
      adult: data.get("adult") === "yes",
      interests: data.getAll("interests").map(String) as OpportunityType[],
    });
    setError(null);
    onClose();
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="profile-title"
      className="m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl bg-card p-0 text-ink shadow-[0_20px_60px_rgba(9,20,48,0.25)] backdrop:bg-[rgba(9,20,48,0.45)]"
    >
      {open && (
        <form onSubmit={submit} className="p-5 sm:p-6" key={initial ? "edit" : "new"}>
          <div className="flex items-start gap-3">
            <div>
              <h2 id="profile-title" className="text-xl font-extrabold tracking-tight">
                {initial ? "Editar seu perfil" : "Monte seu perfil"}
              </h2>
              <p className="mt-1 text-[14px] text-muted">
                Com ele, a página mostra o que serve pra você. Fica salvo só neste navegador.
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar" className="ml-auto grid size-9 shrink-0 place-items-center rounded-full hover:bg-ground">
              <XIcon className="size-5" />
            </button>
          </div>

          <div className="mt-5 grid gap-4">
            <label className="block text-[13.5px] font-semibold">
              Como quer ser chamado <span className="font-normal text-muted">(opcional)</span>
              <input name="name" defaultValue={initial?.name} maxLength={60} autoComplete="given-name" className={field} />
            </label>
            <label className="block text-[13.5px] font-semibold">
              Curso
              <input name="course" list="courses" required defaultValue={initial?.course} maxLength={80} className={field} />
              <datalist id="courses">
                {COURSES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <div className="grid grid-cols-[1fr_8rem] gap-3">
              <label className="block text-[13.5px] font-semibold">
                Cidade
                <input name="city" required defaultValue={initial?.city} maxLength={80} autoComplete="address-level2" className={field} />
              </label>
              <label className="block text-[13.5px] font-semibold">
                Estado
                <select name="state" required defaultValue={initial?.state ?? ""} className={field}>
                  <option value="" disabled>
                    UF
                  </option>
                  {STATES.map((s) => (
                    <option key={s.uf} value={s.uf}>
                      {s.uf}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset>
              <legend className="text-[13.5px] font-semibold">Nível de estudo</legend>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {LEVEL_OPTIONS.map((l) => (
                  <label key={l.value} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2.5 text-[14px] has-checked:border-action has-checked:bg-ground">
                    <input type="radio" name="level" value={l.value} required defaultChecked={(initial?.level ?? "undergraduate") === l.value} className="accent-action" />
                    {l.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-[13.5px] font-semibold">Você tem 18 anos ou mais?</legend>
              <div className="mt-1.5 flex gap-2">
                {[
                  { v: "yes", l: "Sim" },
                  { v: "no", l: "Não" },
                ].map((o) => (
                  <label key={o.v} className="flex flex-1 items-center gap-2 rounded-lg border border-line px-3 py-2.5 text-[14px] has-checked:border-action has-checked:bg-ground">
                    <input type="radio" name="adult" value={o.v} defaultChecked={(initial?.adult ?? true) === (o.v === "yes")} className="accent-action" />
                    {o.l}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-[13.5px] font-semibold">
                O que te interessa <span className="font-normal text-muted">(nenhum marcado = tudo)</span>
              </legend>
              <div className="mt-1.5 grid gap-2">
                {INTEREST_OPTIONS.map((i) => (
                  <label key={i.value} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2.5 text-[14px] has-checked:border-action has-checked:bg-ground">
                    <input type="checkbox" name="interests" value={i.value} defaultChecked={initial?.interests.includes(i.value)} className="accent-action" />
                    {i.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-urgent-bg px-3 py-2 text-[14px] font-semibold text-urgent">
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button type="submit" className="rounded-xl bg-action px-5 py-3 text-[15px] font-bold text-white hover:bg-navy">
              {initial ? "Salvar perfil" : "Ver oportunidades pra mim"}
            </button>
            {initial && (
              <button
                type="button"
                onClick={() => {
                  saveProfile(null);
                  onClose();
                }}
                className="rounded-xl px-4 py-3 text-[14px] font-semibold text-urgent hover:bg-urgent-bg"
              >
                Apagar perfil
              </button>
            )}
          </div>
          <p className="mt-4 text-[12.5px] text-muted">
            Seu curso ainda não esconde nada: as fontes atuais não informam restrição por curso. Ele passa a valer quando
            entrarem bolsas e editais.
          </p>
        </form>
      )}
    </dialog>
  );
}
