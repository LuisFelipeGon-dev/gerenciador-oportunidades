import type { Digest, DigestItem } from "./digest";
import type { OpportunityType } from "./opportunity";
import { itemKey } from "./personalize";

// The weekly e-mail: subject, HTML (inline styles, e-mail clients drop stylesheets) and plain text.
// Everything that comes from the sources is escaped before it goes into the HTML.

const TYPE_LABEL: Record<OpportunityType, string> = {
  hackathon: "Hackathon",
  event: "Evento",
  ambassador: "Embaixador",
  scholarship: "Bolsa",
  internship: "Estágio",
  competition: "Competição",
};

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

export function renderDigest(
  d: Digest,
  opts: { siteUrl: string; unsubscribeUrl: string; email: string },
): { subject: string; html: string; text: string } {
  const link = (i: DigestItem) => `${opts.siteUrl}/#o=${encodeURIComponent(itemKey(i.o))}`;
  const more = d.moreFresh > 0 ? `e mais ${d.moreFresh} no site` : null;

  const sections: { title: string; items: DigestItem[]; footer: string | null }[] = [
    { title: "Novidades pra você", items: d.fresh, footer: more },
    { title: "Prazos dos seus salvos", items: d.closing, footer: null },
  ].filter((s) => s.items.length > 0);

  const why = `Você recebe este resumo semanal porque ligou a opção no seu perfil, com o e-mail ${opts.email}.`;

  const text = [
    ...sections.flatMap((s) => [
      s.title.toUpperCase(),
      "",
      ...s.items.flatMap((i) => [`- ${i.o.title}`, `  ${details(i)}`, `  ${link(i)}`, ""]),
      ...(s.footer ? [`${s.footer}: ${opts.siteUrl}`, ""] : []),
    ]),
    "--",
    why,
    `Ajustar perfil: ${opts.siteUrl}`,
    `Parar de receber: ${opts.unsubscribeUrl}`,
  ].join("\n");

  const itemHtml = (i: DigestItem) => `
          <tr><td style="padding:12px 0;border-top:1px solid #dfe5e3">
            <a href="${escapeHtml(link(i))}" style="color:#1d4fd8;font-size:16px;font-weight:700;text-decoration:none">${escapeHtml(i.o.title)}</a>
            <div style="color:#5b6765;font-size:14px;margin-top:4px">${escapeHtml(details(i))}</div>
          </td></tr>`;

  const sectionHtml = (s: (typeof sections)[number]) => `
      <h2 style="font-size:18px;margin:28px 0 4px;color:#17221f">${escapeHtml(s.title)}</h2>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${s.items.map(itemHtml).join("")}
      </table>${
        s.footer
          ? `
      <p style="margin:8px 0 0;font-size:14px"><a href="${escapeHtml(opts.siteUrl)}" style="color:#1d4fd8">${escapeHtml(s.footer)}</a></p>`
          : ""
      }`;

  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#eef1f6;font-family:Arial,Helvetica,sans-serif;color:#17221f">
    <div style="max-width:600px;margin:0 auto;background:#ffffff">
      <div style="background:#0c2a66;color:#ffffff;padding:20px 24px;font-size:20px;font-weight:700">oportunidades</div>
      <div style="padding:8px 24px 24px">${sections.map(sectionHtml).join("")}
        <p style="margin:32px 0 0;padding-top:16px;border-top:1px solid #dfe5e3;color:#5b6765;font-size:13px;line-height:1.5">
          ${escapeHtml(why)}<br>
          <a href="${escapeHtml(opts.siteUrl)}" style="color:#5b6765">Ajustar perfil</a> ·
          <a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:#5b6765">Parar de receber</a>
        </p>
      </div>
    </div>
  </body>
</html>
`;

  return { subject: digestSubject(d), html, text };
}
