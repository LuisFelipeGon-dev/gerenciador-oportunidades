"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { normalizeText } from "@/lib/search";
import { formatBrDate, maskDate, parseBrDate, suggest } from "@/lib/suggest";
import { CheckIcon, ChevronDownIcon } from "./icons";

// Form controls drawn by the site instead of the browser (native <select>, <datalist> and date
// pickers look different in every browser and ignore the theme). Keyboard and screen readers
// follow the WAI-ARIA combobox pattern: focus stays on the field, the list is announced through
// aria-activedescendant. Values reach the form through a named input, so FormData keeps working.

export const fieldClass =
  "h-11 w-full min-w-0 rounded-md border border-line bg-card px-3 text-[15px] text-ink transition-[border-color,box-shadow] placeholder:text-muted focus:border-action focus:shadow-[0_0_0_3px_var(--sky-tint)] focus:outline-none";
const labelClass = "block text-[13.5px] font-semibold";
const hintClass = "mt-1 block text-[12.5px] font-normal text-muted";
const listClass =
  "absolute inset-x-0 z-30 max-h-64 overflow-y-auto overscroll-contain rounded-md border border-line-strong bg-card p-1 shadow-[0_18px_40px_-12px_rgb(var(--shadow-rgb)/0.35)] animate-[fade-in_.12s_ease-out]";
const optionClass =
  "flex cursor-pointer items-center justify-between gap-2 rounded-[4px] px-2.5 py-2 text-[14.5px]";

/** Opens the list upwards when there is no room below inside the dialog (or the window). */
function opensUp(field: HTMLElement | null): boolean {
  if (!field) return false;
  const rect = field.getBoundingClientRect();
  const bounds = field.closest("dialog")?.getBoundingClientRect() ?? {
    top: 0,
    bottom: window.innerHeight,
  };
  const below = bounds.bottom - rect.bottom;
  return below < 270 && rect.top - bounds.top > below;
}

/** Closes when a pointer goes down outside `ref`. */
function useOutside(
  ref: React.RefObject<HTMLElement | null>,
  open: boolean,
  close: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [ref, open, close]);
}

function scrollOptionIntoView(id: string) {
  document.getElementById(id)?.scrollIntoView({ block: "nearest" });
}

export type SelectOption = { value: string; label: string };

/** A fixed list of options, like <select>. */
export function Select({
  label,
  name,
  value,
  onChange,
  options,
  placeholder = "Escolha",
  hint,
  className = "",
}: {
  label: React.ReactNode;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  hint?: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const [active, setActive] = useState(0);
  const typed = useRef({ text: "", at: 0 });
  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = options[selectedIndex];

  const close = useCallback(() => setOpen(false), []);
  useOutside(wrapRef, open, close);

  useEffect(() => {
    if (open) scrollOptionIntoView(`${id}-opt-${active}`);
  }, [open, active, id]);

  function show() {
    setUp(opensUp(buttonRef.current));
    setActive(Math.max(selectedIndex, 0));
    setOpen(true);
  }

  function choose(index: number) {
    onChange(options[index].value);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const last = options.length - 1;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    const moves: Record<string, number> = {
      ArrowDown: Math.min(active + 1, last),
      ArrowUp: Math.max(active - 1, 0),
      Home: 0,
      End: last,
      PageDown: Math.min(active + 8, last),
      PageUp: Math.max(active - 8, 0),
    };
    if (e.key in moves) {
      e.preventDefault();
      setActive(moves[e.key]);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape") {
      // Keeps the surrounding dialog open: Esc only closes the list.
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === "Tab") {
      setOpen(false);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Type to jump, like a native select: "m", "mt" -> "MT".
      const now = Date.now();
      const text =
        (now - typed.current.at < 700 ? typed.current.text : "") +
        normalizeText(e.key);
      typed.current = { text, at: now };
      const match = options.findIndex((o) =>
        normalizeText(o.label).startsWith(text),
      );
      if (match >= 0) setActive(match);
    }
  }

  return (
    <div ref={wrapRef} className={`min-w-0 ${className}`}>
      <span
        id={`${id}-label`}
        className={labelClass}
        onClick={() => buttonRef.current?.focus()}
      >
        {label}
      </span>
      {/* The list is anchored to the field, not to the block (a hint or a taller grid row below). */}
      <div className="relative mt-1">
        <button
          ref={buttonRef}
          id={`${id}-button`}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-labelledby={`${id}-label ${id}-button`}
          aria-describedby={hint ? `${id}-hint` : undefined}
          aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
          onClick={() => (open ? setOpen(false) : show())}
          onKeyDown={onKeyDown}
          className={`${fieldClass} flex items-center justify-between gap-2 text-left ${open ? "border-action shadow-[0_0_0_3px_var(--sky-tint)]" : ""}`}
        >
          <span className={`truncate ${selected ? "" : "text-muted"}`}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronDownIcon
            className={`size-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        <input type="hidden" name={name} value={value} />
        {open && (
          <ul
            id={`${id}-list`}
            role="listbox"
            aria-labelledby={`${id}-label`}
            className={`${listClass} ${up ? "bottom-full mb-1" : "top-full mt-1"}`}
          >
            {options.map((o, i) => (
              <li
                key={o.value}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={o.value === value}
                onPointerMove={() => setActive(i)}
                onClick={() => {
                  choose(i);
                  buttonRef.current?.focus();
                }}
                className={`${optionClass} ${i === active ? "bg-sky-tint" : ""} ${o.value === value ? "font-semibold text-action" : ""}`}
              >
                <span className="truncate">{o.label}</span>
                {o.value === value && <CheckIcon className="size-4 shrink-0" />}
              </li>
            ))}
          </ul>
        )}
      </div>
      {hint && (
        <span id={`${id}-hint`} className={hintClass}>
          {hint}
        </span>
      )}
    </div>
  );
}

/** A text field with suggestions as you type; any text is accepted, like <input list>. */
export function Combobox({
  label,
  name,
  value,
  onChange,
  options,
  maxLength,
  hint,
  className = "",
}: {
  label: React.ReactNode;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  maxLength?: number;
  hint?: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const [active, setActive] = useState(-1);
  const items = useMemo(() => suggest(options, value), [options, value]);
  // Nothing to suggest, or the only suggestion is what is already typed.
  const showList =
    open &&
    items.length > 0 &&
    !(items.length === 1 && normalizeText(items[0]) === normalizeText(value));

  const close = useCallback(() => setOpen(false), []);
  useOutside(wrapRef, open, close);

  useEffect(() => {
    if (showList && active >= 0) scrollOptionIntoView(`${id}-opt-${active}`);
  }, [showList, active, id]);

  function show() {
    setUp(opensUp(inputRef.current));
    setOpen(true);
  }

  function choose(option: string) {
    onChange(option);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) show();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && showList && active >= 0) {
      e.preventDefault();
      choose(items[active]);
    } else if (e.key === "Escape" && showList) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className={`min-w-0 ${className}`}>
      <label htmlFor={`${id}-input`} className={labelClass}>
        {label}
      </label>
      <div className="relative mt-1">
        <input
          ref={inputRef}
          id={`${id}-input`}
          name={name}
          value={value}
          maxLength={maxLength}
          // Off: the browser's own autofill list would cover the site's suggestions.
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={`${id}-list`}
          aria-describedby={hint ? `${id}-hint` : undefined}
          aria-activedescendant={
            showList && active >= 0 ? `${id}-opt-${active}` : undefined
          }
          onFocus={show}
          onClick={() => !open && show()}
          onChange={(e) => {
            onChange(e.target.value);
            setActive(-1);
            if (!open) show();
          }}
          onKeyDown={onKeyDown}
          className={fieldClass}
        />
        {showList && (
          <ul
            id={`${id}-list`}
            role="listbox"
            aria-label="Sugestões"
            className={`${listClass} ${up ? "bottom-full mb-1" : "top-full mt-1"}`}
          >
            {items.map((item, i) => (
              <li
                key={item}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                // Keeps focus in the field, so the list does not close before the click.
                onPointerDown={(e) => e.preventDefault()}
                onPointerMove={() => setActive(i)}
                onClick={() => choose(item)}
                className={`${optionClass} ${i === active ? "bg-sky-tint" : ""}`}
              >
                <span className="truncate">{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {hint && (
        <span id={`${id}-hint`} className={hintClass}>
          {hint}
        </span>
      )}
    </div>
  );
}

/** A date typed as DD/MM/AAAA (numeric keyboard on phones); the form receives it as AAAA-MM-DD. */
export function DateField({
  label,
  name,
  defaultValue,
  hint,
}: {
  label: React.ReactNode;
  name: string;
  defaultValue?: string;
  hint?: React.ReactNode;
}) {
  const id = useId();
  const [text, setText] = useState(formatBrDate(defaultValue));
  return (
    <div className="min-w-0">
      <label htmlFor={`${id}-input`} className={labelClass}>
        {label}
      </label>
      <input
        id={`${id}-input`}
        value={text}
        onChange={(e) => setText(maskDate(e.target.value))}
        inputMode="numeric"
        placeholder="DD/MM/AAAA"
        autoComplete="off"
        maxLength={10}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={`${fieldClass} mt-1 font-mono tracking-tight`}
      />
      <input type="hidden" name={name} value={parseBrDate(text) ?? ""} />
      {hint && (
        <span id={`${id}-hint`} className={hintClass}>
          {hint}
        </span>
      )}
    </div>
  );
}
