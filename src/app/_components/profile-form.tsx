"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { saveProfile, setAlerts, useAlerts } from "@/lib/account";
import { AREAS, areaById, areaForCourse, type AreaId } from "@/lib/areas";
import { STATES, isUF } from "@/lib/brazil";
import { findMunicipality } from "@/lib/geo";
import { campusNames } from "@/lib/institutions";
import { useMunicipalities } from "@/lib/municipalities";
import { normalizeText } from "@/lib/search";
import type { OpportunityType } from "@/lib/opportunity";
import { ageOn, DEFAULT_RADIUS_KM, localToday, RADIUS_OPTIONS, type Level, type Profile } from "@/lib/personalize";
import { Combobox, DateField, fieldClass, Select } from "./fields";
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

// Suggestions only: any university can be typed.
const INSTITUTIONS = ["UFMT", "UNEMAT", "IFMT", "UFR", "UNIC", "UNIVAG", "UNIFASIPE", "UNIRONDON"];

const AREA_OPTIONS = AREAS.map((a) => ({ value: a.id, label: a.label }));
const STATE_OPTIONS = STATES.map((s) => ({ value: s.uf, label: s.uf }));
const RADIUS_SELECT = RADIUS_OPTIONS.map((km) => ({ value: String(km), label: `${km} km da sua cidade` }));

const choice =
  "flex min-h-11 min-w-0 cursor-pointer items-center gap-2.5 rounded-md border border-line px-3 py-2.5 text-[14px] transition-colors hover:border-line-strong has-checked:border-action has-checked:bg-sky-tint";
const sectionTitle = "font-mono text-[12px] font-semibold tracking-tight text-muted uppercase";

function Fields({ initial, onClose }: { initial: Profile | null; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [area, setArea] = useState<AreaId>(initial?.area ?? "other");
  const [areaTouched, setAreaTouched] = useState(!!initial);
  const [course, setCourse] = useState(initial?.course ?? "");
  const [state, setState] = useState<string>(initial?.state ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [institution, setInstitution] = useState(initial?.institution ?? "");
  const [campus, setCampus] = useState(initial?.campus ?? "");
  const [radiusKm, setRadiusKm] = useState(String(initial?.radiusKm ?? DEFAULT_RADIUS_KM));
  const municipalities = useMunicipalities(state);
  const cityNames = useMemo(() => municipalities?.map(([name]) => name) ?? [], [municipalities]);
  // Not while the person is still typing the start of a real city ("cuia" -> Cuiabá).
  const cityUnknown =
    municipalities !== null &&
    city.trim() !== "" &&
    !findMunicipality(municipalities, city) &&
    !cityNames.some((name) => normalizeText(name).startsWith(normalizeText(city)));
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
    const institution = String(data.get("institution") ?? "").trim();
    const campus = String(data.get("campus") ?? "").trim();
    if (!course || !city || !isUF(state) || !LEVEL_OPTIONS.some((l) => l.value === level)) {
      setError("Preencha curso, cidade, estado e nível de estudo.");
      return;
    }
    if (!institution || !campus) {
      setError("Preencha a instituição de ensino e o câmpus: os editais de cada instituição só aparecem para quem estuda lá.");
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
      institution,
      campus,
    });
    // Only on change: turning it on records the date of consent.
    const wantsAlerts = data.get("alerts") === "on";
    if (alerts && wantsAlerts !== alerts.enabled) void setAlerts(wantsAlerts);
    setError(null);
    onClose();
  }

  const defaults = areaById(area).defaultTypes.map((t) => TYPE_PLURAL[t].toLowerCase());

  return (
    // noValidate: the checks in submit() show the site's own message instead of the browser's.
    <form onSubmit={submit} noValidate className="p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div>
          <h2 id="profile-title" className="font-mono text-xl font-semibold tracking-[-0.045em]">
            {initial ? "Editar seu perfil" : "Monte seu perfil"}
          </h2>
          <p className="mt-1 text-[14px] text-muted">Com ele, a página mostra o que serve pra você.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="ml-auto grid size-10 shrink-0 place-items-center rounded-md text-muted hover:bg-card-2 hover:text-ink"
        >
          <XIcon className="size-5" />
        </button>
      </div>

      <div className="mt-6 grid gap-4">
        <p className={sectionTitle}>Você</p>
        <label className="block min-w-0 text-[13.5px] font-semibold">
          Como quer ser chamado <span className="font-normal text-muted">(opcional)</span>
          <input name="name" defaultValue={initial?.name} maxLength={60} autoComplete="given-name" className={`${fieldClass} mt-1`} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <DateField label="Data de nascimento" name="birthDate" defaultValue={initial?.birthDate} hint="Só para checar idade mínima (16+, 18+)." />
          <Select label="Perto de você é até" name="radiusKm" value={radiusKm} onChange={setRadiusKm} options={RADIUS_SELECT} />
        </div>
        <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3">
          <Select
            label="Estado"
            name="state"
            value={state}
            onChange={(uf) => {
              if (uf !== state) setCity("");
              setState(uf);
            }}
            options={STATE_OPTIONS}
            placeholder="UF"
          />
          <Combobox
            label="Cidade"
            name="city"
            value={city}
            onChange={setCity}
            options={cityNames}
            maxLength={80}
            hint={state ? undefined : "Escolha o estado para ver as cidades."}
          />
        </div>
        {cityUnknown && (
          <p className="-mt-2 text-[12.5px] text-muted">
            Não achamos essa cidade em {state}. A página vai mostrar o que é perto pelo estado, sem distância.
          </p>
        )}

        <p className={`${sectionTitle} mt-2`}>Onde você estuda</p>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_15rem]">
          <Combobox
            label="Curso"
            name="course"
            value={course}
            onChange={(c) => {
              setCourse(c);
              if (!areaTouched) setArea(areaForCourse(c));
            }}
            options={COURSES}
            maxLength={80}
          />
          <Select
            label="Área"
            name="area"
            value={area}
            onChange={(a) => {
              setArea(a as AreaId);
              setAreaTouched(true);
            }}
            options={AREA_OPTIONS}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Combobox label="Instituição de ensino" name="institution" value={institution} onChange={setInstitution} options={INSTITUTIONS} maxLength={80} />
          {/* Campuses of the institutions the site collects as suggestions; others are typed freely. */}
          <Combobox label="Câmpus" name="campus" value={campus} onChange={setCampus} options={campusNames(institution)} maxLength={80} />
        </div>
        <p className="-mt-2 text-[12.5px] text-muted">
          Editais de uma instituição só aparecem para quem estuda nela (e no câmpus, quando o edital é de um só).
        </p>
        <fieldset>
          <legend className="text-[13.5px] font-semibold">Nível de estudo</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {LEVEL_OPTIONS.map((l) => (
              <label key={l.value} className={choice}>
                <input type="radio" name="level" value={l.value} defaultChecked={(initial?.level ?? "undergraduate") === l.value} className="check" />
                {l.label}
              </label>
            ))}
          </div>
        </fieldset>

        <p className={`${sectionTitle} mt-2`}>O que você quer ver</p>
        <fieldset>
          <legend className="text-[13.5px] font-semibold">O que te interessa</legend>
          <p className="text-[12.5px] text-muted">
            Nenhum marcado = o padrão de {areaById(area).label}: {defaults.join(", ")}.
          </p>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
            {INTEREST_OPTIONS.map((i) => (
              <label key={i.value} className={choice}>
                <input type="checkbox" name="interests" value={i.value} defaultChecked={initial?.interests.includes(i.value)} className="check" />
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
                <input type="checkbox" name="alerts" defaultChecked={alerts.enabled} className="check mt-0.5" />
                <span>Quero um resumo por e-mail toda segunda com o que serve pra mim</span>
              </label>
              <p className="mt-1 text-[12.5px] text-muted">
                Vai para {alerts.email}. Dá para parar a qualquer momento, aqui ou pelo link no próprio e-mail.
              </p>
            </>
          ) : alerts === null ? (
            <p className="mt-1 text-[13.5px] text-muted">
              <Link href="/entrar" className="font-semibold text-action underline-offset-2 hover:underline">
                Entre com seu e-mail
              </Link>{" "}
              para receber um resumo semanal com o que serve pra você.
            </p>
          ) : null}
        </fieldset>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-urgent-bg px-3 py-2 text-[14px] font-semibold text-urgent">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className="inline-flex h-11 items-center rounded-md bg-btn px-5 font-mono text-[13.5px] font-semibold tracking-tight text-on-btn transition-[background-color,transform] hover:bg-btn-hover active:scale-[.98]"
        >
          {initial ? "Salvar perfil" : "Ver oportunidades pra mim"}
        </button>
        {initial && (
          <button
            type="button"
            onClick={() => {
              void saveProfile(null);
              onClose();
            }}
            className="inline-flex h-11 items-center rounded-md px-4 font-mono text-[13px] font-semibold tracking-tight text-urgent hover:bg-urgent-bg"
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
      className="m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-lg bg-card p-0 text-ink border border-line-strong shadow-[0_30px_80px_rgb(0_0_0/0.45)] open:animate-[sheet-in_.32s_cubic-bezier(.2,.8,.2,1)]"
    >
      {open && <Fields initial={initial} onClose={onClose} />}
    </dialog>
  );
}
