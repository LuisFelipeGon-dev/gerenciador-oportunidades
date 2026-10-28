"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { saveProfile, setAlerts, useAlerts } from "@/lib/account";
import { AREAS, areaById, areaForCourse, type AreaId } from "@/lib/areas";
import { STATES, isUF } from "@/lib/brazil";
import { findMunicipality } from "@/lib/geo";
import { useMunicipalities } from "@/lib/municipalities";
import type { OpportunityType } from "@/lib/opportunity";
import { ageOn, DEFAULT_RADIUS_KM, localToday, RADIUS_OPTIONS, type Level, type Profile } from "@/lib/personalize";
import { TYPE_PLURAL } from "./format";
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
  { value: "competition", label: "Competições e olimpíadas" },
  { value: "internship", label: "Estágios e mentorias pagas" },
  { value: "scholarship", label: "Bolsas" },
];

const COURSES = [
  "Administração", "Agronomia", "Análise e Desenvolvimento de Sistemas", "Arquitetura e Urbanismo", "Biologia",
  "Biomedicina", "Ciência da Computação", "Ciências Contábeis", "Ciências Sociais", "Cinema e Audiovisual", "Design",
  "Direito", "Economia", "Educação Física", "Enfermagem", "Engenharia Agrícola", "Engenharia Civil",
  "Engenharia de Computação", "Engenharia de Software", "Engenharia Elétrica", "Engenharia Florestal",
  "Engenharia Mecânica", "Farmácia", "Física", "Fisioterapia", "Geografia", "História", "Jornalismo", "Letras",
  "Matemática", "Medicina", "Medicina Veterinária", "Nutrição", "Odontologia", "Pedagogia", "Psicologia",
  "Publicidade e Propaganda", "Química", "Relações Internacionais", "Relações Públicas", "Serviço Social",
  "Sistemas de Informação", "Zootecnia",
];

const field = "mt-1 w-full min-w-0 rounded-lg border border-line bg-card px-3 py-2.5 text-[15px] focus:border-action focus:outline-none";
const choice = "flex min-w-0 items-center gap-2 rounded-lg border border-line px-3 py-2.5 text-[14px] has-checked:border-action has-checked:bg-ground";

function Fields({ initial, onClose }: { initial: Profile | null; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [area, setArea] = useState<AreaId>(initial?.area ?? "other");
  const [areaTouched, setAreaTouched] = useState(!!initial);
  const [state, setState] = useState<string>(initial?.state ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const municipalities = useMunicipalities(state);
  const cityUnknown = municipalities !== null && city.trim() !== "" && !findMunicipality(municipalities, city);
  const today = localToday();
  const alerts = useAlerts();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const state = String(data.get("state") ?? "");
    const course = String(data.get("course") ?? "").trim();
    const city = String(data.get("city") ?? "").trim();
    const level = String(data.get("level") ?? "") as Level;
    const birthDate = String(data.get("birthDate") ?? "");
    const radiusKm = Number(data.get("radiusKm")) || DEFAULT_RADIUS_KM;
    if (!course || !city || !isUF(state) || !LEVEL_OPTIONS.some((l) => l.value === level)) {
      setError("Preencha curso, cidade, estado e nível de estudo.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || birthDate > today || ageOn(birthDate, today) > 100) {
      setError("Confira a data de nascimento.");
      return;
    }
    void saveProfile({
      name: String(data.get("name") ?? "").trim(),
      course,
      area,
      city,
      state,
      level,
      birthDate,
      interests: data.getAll("interests").map(String) as OpportunityType[],
      radiusKm,
    });
    // Only on change: turning it on records the date of consent.
    const wantsAlerts = data.get("alerts") === "on";
    if (alerts && wantsAlerts !== alerts.enabled) void setAlerts(wantsAlerts);
    setError(null);
    onClose();
  }

  const defaults = areaById(area).defaultTypes.map((t) => TYPE_PLURAL[t].toLowerCase());

  return (
    <form onSubmit={submit} className="p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div>
          <h2 id="profile-title" className="text-xl font-extrabold tracking-tight">
            {initial ? "Editar seu perfil" : "Monte seu perfil"}
          </h2>
          <p className="mt-1 text-[14px] text-muted">Com ele, a página mostra o que serve pra você.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar" className="ml-auto grid size-9 shrink-0 place-items-center rounded-full hover:bg-ground">
          <XIcon className="size-5" />
        </button>
      </div>

      <div className="mt-5 grid gap-4">
        <label className="block min-w-0 text-[13.5px] font-semibold">
          Como quer ser chamado <span className="font-normal text-muted">(opcional)</span>
          <input name="name" defaultValue={initial?.name} maxLength={60} autoComplete="given-name" className={field} />
        </label>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <label className="block min-w-0 text-[13.5px] font-semibold">
            Curso
            <input
              name="course"
              list="courses"
              required
              defaultValue={initial?.course}
              maxLength={80}
              onChange={(e) => {
                if (!areaTouched) setArea(areaForCourse(e.target.value));
              }}
              className={field}
            />
            <datalist id="courses">
              {COURSES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="block min-w-0 text-[13.5px] font-semibold">
            Área
            <select
              name="area"
              value={area}
              onChange={(e) => {
                setArea(e.target.value as AreaId);
                setAreaTouched(true);
              }}
              className={field}
            >
              {AREAS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3">
          <label className="block min-w-0 text-[13.5px] font-semibold">
            Cidade
            <input
              name="city"
              list="cities"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={80}
              autoComplete="address-level2"
              className={field}
            />
            <datalist id="cities">
              {municipalities?.map(([name]) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          <label className="block min-w-0 text-[13.5px] font-semibold">
            Estado
            <select name="state" required value={state} onChange={(e) => setState(e.target.value)} className={field}>
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
        {cityUnknown && (
          <p className="-mt-2 text-[12.5px] text-muted">
            Não achamos essa cidade em {state}. A página vai mostrar o que é perto pelo estado, sem distância.
          </p>
        )}
        <label className="block min-w-0 text-[13.5px] font-semibold">
          Perto de você é até
          <select name="radiusKm" defaultValue={initial?.radiusKm ?? DEFAULT_RADIUS_KM} className={field}>
            {RADIUS_OPTIONS.map((km) => (
              <option key={km} value={km}>
                {km} km da sua cidade
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-0 text-[13.5px] font-semibold">
          Data de nascimento
          <input name="birthDate" type="date" required min="1920-01-01" max={today} defaultValue={initial?.birthDate} autoComplete="bday" className={field} />
          <span className="mt-1 block text-[12.5px] font-normal text-muted">
            Usada só para checar idade mínima (16+, 18+). A página mostra apenas a idade.
          </span>
        </label>
        <fieldset>
          <legend className="text-[13.5px] font-semibold">Nível de estudo</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {LEVEL_OPTIONS.map((l) => (
              <label key={l.value} className={choice}>
                <input type="radio" name="level" value={l.value} required defaultChecked={(initial?.level ?? "undergraduate") === l.value} className="accent-action" />
                {l.label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-[13.5px] font-semibold">O que te interessa</legend>
          <p className="text-[12.5px] text-muted">Nenhum marcado = o padrão de {areaById(area).label}: {defaults.join(", ")}.</p>
          <div className="mt-1.5 grid gap-2">
            {INTEREST_OPTIONS.map((i) => (
              <label key={i.value} className={choice}>
                <input type="checkbox" name="interests" value={i.value} defaultChecked={initial?.interests.includes(i.value)} className="accent-action" />
                {i.label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-[13.5px] font-semibold">Resumo por e-mail</legend>
          {alerts ? (
            <>
              {/* key: re-mounts with the saved value once it loads. */}
              <label key={String(alerts.enabled)} className={`${choice} mt-1.5 items-start`}>
                <input type="checkbox" name="alerts" defaultChecked={alerts.enabled} className="mt-0.5 accent-action" />
                <span>Quero um resumo por e-mail toda segunda com o que serve pra mim</span>
              </label>
              <p className="mt-1 text-[12.5px] text-muted">
                Vai para {alerts.email}. Dá para parar a qualquer momento, aqui ou pelo link no próprio e-mail.
              </p>
            </>
          ) : (
            <p className="mt-1 text-[13.5px] text-muted">
              <Link href="/entrar" className="font-semibold text-action underline-offset-2 hover:underline">
                Entre com seu e-mail
              </Link>{" "}
              para receber um resumo semanal com o que serve pra você.
            </p>
          )}
        </fieldset>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-urgent-bg px-3 py-2 text-[14px] font-semibold text-urgent">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button type="submit" className="rounded-xl bg-action px-5 py-3 text-[15px] font-bold text-card hover:bg-action-strong">
          {initial ? "Salvar perfil" : "Ver oportunidades pra mim"}
        </button>
        {initial && (
          <button
            type="button"
            onClick={() => {
              void saveProfile(null);
              onClose();
            }}
            className="rounded-xl px-4 py-3 text-[14px] font-semibold text-urgent hover:bg-urgent-bg"
          >
            Limpar perfil deste navegador
          </button>
        )}
      </div>
    </form>
  );
}

export function ProfileForm({ open, initial, onClose }: { open: boolean; initial: Profile | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="profile-title"
      className="m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl bg-card p-0 text-ink shadow-[0_20px_60px_rgba(9,20,48,0.25)] backdrop:bg-[rgba(9,20,48,0.45)]"
    >
      {open && <Fields initial={initial} onClose={onClose} />}
    </dialog>
  );
}
