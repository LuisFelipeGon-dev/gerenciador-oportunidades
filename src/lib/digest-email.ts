import type { Digest, DigestItem } from "./digest";
import type { OpportunityType } from "./opportunity";
import { daysUntil, itemKey } from "./personalize";

// The weekly e-mail in the Topa? look: subject, HTML and plain text. E-mail clients drop
// stylesheets and SVG, so the HTML is tables with inline styles and the logo is a hosted PNG.
// Everything that comes from the sources is escaped before it goes into the HTML.

const TYPE_LABEL: Record<OpportunityType, string> = {
  hackathon: "Hackathon",
  event: "Evento",
  ambassador: "Embaixador",
  scholarship: "Bolsa",
  internship: "Estágio",
  competition: "Competição",
};

/** Light-theme colors of the site (identidade/tokens.json and globals.css). */
const C = {
  ground: "#f4f8fe",
  card: "#ffffff",
  ink: "#0b1b3d",
  muted: "#4a5a7a",
  line: "#d3dff0",
  navy: "#0c2a66",
  action: "#0970ad",
  skyTint: "#e3f4ff",
  urgent: "#c2372c",
  urgentBg: "#fdecea",
  prize: "#126b41",
  prizeBg: "#e4f5ec",
};

const TYPE_TONE: Record<OpportunityType, { bg: string; fg: string }> = {
  hackathon: { bg: "#fdebe7", fg: "#b83a25" },
  event: { bg: "#e2f5f2", fg: "#0a7368" },
  ambassador: { bg: "#f1eafe", fg: "#6d32d6" },
  competition: { bg: "#f1eafe", fg: "#6d32d6" },
  scholarship: { bg: C.skyTint, fg: C.action },
  internship: { bg: C.skyTint, fg: C.action },
};

const URGENT_WITHIN_DAYS = 3;
const FONT = "font-family:Figtree,'Segoe UI',Arial,Helvetica,sans-serif";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function digestSubject(d: Digest): string {
  const parts = [];
  if (d.fresh.length > 0) parts.push(`${plural(d.fresh.length, "oportunidade", "oportunidades")} pra você`);
  if (d.closing.length > 0) parts.push(`${plural(d.closing.length, "prazo", "prazos")} esta semana`);
  return parts.join(" e ");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** "2026-11-15" -> "15/11", as a calendar date (no time zone shift). */
const dayMonth = (isoDate: string) => `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}`;

function when({ o }: DigestItem): string | null {
  if (o.registrationDeadline) return `fecha em ${dayMonth(o.registrationDeadline)}`;
  if (o.startsOn) return `acontece em ${dayMonth(o.startsOn)}`;
  return null;
}

function where({ o, distanceKm }: DigestItem): string {
  if (o.modality === "online") return "Online";
  const place = [o.location.city, o.location.country === "BR" ? o.location.state : o.location.country].filter(Boolean).join(", ") || "Presencial";
  return distanceKm !== null ? `${place} · a ${Math.max(1, Math.round(distanceKm))} km` : place;
}

const details = (d: DigestItem) => [TYPE_LABEL[d.o.type], when(d), where(d), d.o.benefits[0]].filter(Boolean).join(" · ");

const pill = (text: string, bg: string, fg: string, extra = "") =>
  `<span ${extra}style="display:inline-block;padding:3px 10px;border-radius:999px;background:${bg};color:${fg};font-size:12px;font-weight:700;letter-spacing:.02em">${escapeHtml(text)}</span>`;

const button = (href: string, label: string, primary: boolean) =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;padding:10px 18px;border-radius:10px;${
    primary ? `background:${C.action};color:#ffffff` : `background:${C.card};color:${C.action};border:1px solid ${C.line}`
  };font-size:14px;font-weight:700;text-decoration:none">${escapeHtml(label)}</a>`;

export function renderDigest(
  d: Digest,
  opts: { siteUrl: string; unsubscribeUrl: string; email: string; today: string },
): { subject: string; html: string; text: string } {
  const link = (i: DigestItem) => `${opts.siteUrl}/#o=${encodeURIComponent(itemKey(i.o))}`;
  const more = d.moreFresh > 0 ? `e mais ${d.moreFresh} no site` : null;
  const intro = "Separamos o que serve pra você nesta semana.";

  const sections: { title: string; items: DigestItem[]; footer: string | null }[] = [
    { title: "Novidades pra você", items: d.fresh, footer: more },
    { title: "Prazos dos seus salvos", items: d.closing, footer: null },
  ].filter((s) => s.items.length > 0);

  const why = `Você recebe este resumo semanal porque ligou a opção no seu perfil, com o e-mail ${opts.email}.`;

  const text = [
    intro,
    "",
    ...sections.flatMap((s) => [
      s.title.toUpperCase(),
      "",
      ...s.items.flatMap((i) => [`- ${i.o.title}`, `  ${details(i)}`, `  ${link(i)}`, ""]),
      ...(s.footer ? [`${s.footer}: ${opts.siteUrl}`, ""] : []),
    ]),
    `Ver tudo no Topa?: ${opts.siteUrl}`,
    "",
    "--",
    why,
    `Ajustar perfil: ${opts.siteUrl}`,
    `Parar de receber: ${opts.unsubscribeUrl}`,
  ].join("\n");

  const card = (i: DigestItem) => {
    const tone = TYPE_TONE[i.o.type];
    const date = when(i);
    const deadline = i.o.registrationDeadline;
    const urgent = !!deadline && daysUntil(deadline, opts.today) <= URGENT_WITHIN_DAYS;
    const prize = i.o.benefits[0];
    return `
              <tr><td style="padding:0 0 12px">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-radius:14px;background:${C.card}">
                  <tr><td style="padding:16px 18px">
                    <div>${pill(TYPE_LABEL[i.o.type], tone.bg, tone.fg)}${
                      date ? ` ${pill(date, urgent ? C.urgentBg : C.skyTint, urgent ? C.urgent : C.navy, urgent ? "data-urgent " : "")}` : ""
                    }</div>
                    <div style="margin:10px 0 4px;font-size:17px;line-height:1.3;font-weight:800;color:${C.ink}">${escapeHtml(i.o.title)}</div>
                    <div style="font-size:14px;line-height:1.5;color:${C.muted}">${escapeHtml(where(i))}${
                      i.o.organizer ? ` · ${escapeHtml(i.o.organizer)}` : ""
                    }</div>${
                      prize
                        ? `
                    <div style="margin-top:8px">${pill(prize, C.prizeBg, C.prize)}</div>`
                        : ""
                    }
                    <div style="margin-top:14px">${button(link(i), "Ver no Topa?", true)}</div>
                  </td></tr>
                </table>
              </td></tr>`;
  };

  const sectionHtml = (s: (typeof sections)[number]) => `
          <tr><td style="padding:24px 24px 4px">
            <div style="font-size:19px;font-weight:800;color:${C.ink}">${escapeHtml(s.title)}</div>
          </td></tr>
          <tr><td style="padding:8px 24px 0">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${s.items.map(card).join("")}
            </table>${
              s.footer
                ? `
            <div style="font-size:14px;padding:2px 0 4px"><a href="${escapeHtml(opts.siteUrl)}" style="color:${C.action};font-weight:700">${escapeHtml(s.footer)}</a></div>`
                : ""
            }
          </td></tr>`;

  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${escapeHtml(digestSubject(d))}</title>
  </head>
  <body style="margin:0;padding:0;background:${C.ground};${FONT};color:${C.ink}">
    <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(intro)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.ground}">
      <tr><td align="center" style="padding:24px 12px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${C.card};border-radius:18px;overflow:hidden">
          <tr><td style="background:${C.navy};padding:22px 24px">
            <a href="${escapeHtml(opts.siteUrl)}"><img src="${escapeHtml(opts.siteUrl)}/brand/topa-wordmark-dark.png" alt="Topa?" height="30" style="display:block;height:30px;width:auto;border:0"></a>
            <div style="margin-top:14px;font-size:22px;line-height:1.25;font-weight:800;color:#ffffff">${escapeHtml(intro)}</div>
            <div style="margin-top:6px;font-size:14px;color:#b8c8ec">${escapeHtml(digestSubject(d))}</div>
          </td></tr>${sections.map(sectionHtml).join("")}
          <tr><td align="center" style="padding:16px 24px 28px">${button(opts.siteUrl, "Ver tudo no Topa?", false)}</td></tr>
          <tr><td style="padding:18px 24px 24px;border-top:1px solid ${C.line};font-size:12.5px;line-height:1.6;color:${C.muted}">
            ${escapeHtml(why)}<br>
            <a href="${escapeHtml(opts.siteUrl)}" style="color:${C.muted}">Ajustar perfil</a> ·
            <a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:${C.muted}">Parar de receber</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
`;

  return { subject: digestSubject(d), html, text };
}
