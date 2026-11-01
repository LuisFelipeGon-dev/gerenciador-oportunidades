import type { Opportunity } from "./opportunity";
import { itemKey } from "./personalize";

// "Me avise quando abrir": a person watches a closed program and gets one e-mail when its
// registrations open (spec: docs/design/melhorias-2026-11.md). The daily job reads the watches,
// sends the ones that came due and records notified_at, so nobody gets the same notice twice.

export type WatchRow = { user_id: string; item_key: string; notified_at: string | null };

/** Only curated programs have a yearly window worth waiting for; open ones need no notice. */
export function canWatch(o: Opportunity): boolean {
  return o.source === "curated" && o.status !== "open";
}

export function dueWatches(watches: WatchRow[], programs: Opportunity[]): { userId: string; program: Opportunity }[] {
  const open = new Map(programs.filter((p) => p.status === "open").map((p) => [itemKey(p), p]));
  return watches
    .filter((w) => w.notified_at === null && open.has(w.item_key))
    .map((w) => ({ userId: w.user_id, program: open.get(w.item_key)! }));
}

/**
 * Path of an opportunity's own page, also used in shared links (src/app/o/[source]/[id]).
 * Some ids carry "/" (UNEMAT paths); it travels as "~" so the id stays one URL segment.
 */
export const opportunityPath = (o: Pick<Opportunity, "source" | "sourceId">) =>
  `/o/${encodeURIComponent(o.source)}/${encodeURIComponent(o.sourceId.replaceAll("/", "~"))}`;

/** The source and id back from the two URL segments (already decoded by the router). */
export const sourceIdFromSegment = (segment: string) => segment.replaceAll("~", "/");

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const dayMonth = (isoDate: string) => `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}`;

export function renderOpenedEmail(o: Opportunity, opts: { siteUrl: string }): { subject: string; html: string; text: string } {
  const page = `${opts.siteUrl}${opportunityPath(o)}`;
  const deadline = o.registrationDeadline ? `Inscrições até ${dayMonth(o.registrationDeadline)}.` : "Confira o prazo na página oficial.";
  const subject = `Abriu: ${o.title}`;
  const text = [
    `${o.title} abriu as inscrições.`,
    o.organizer ? `Quem organiza: ${o.organizer}.` : null,
    o.benefits.length > 0 ? `Você ganha: ${o.benefits.join(", ")}.` : null,
    deadline,
    "",
    `Página oficial: ${o.officialUrl}`,
    `No Topa?: ${page}`,
    "",
    "Você pediu este aviso no Topa?. Ele vem uma vez só; para receber de novo, ligue o aviso outra vez.",
  ]
    .filter((l) => l !== null)
    .join("\n");

  const font = "font-family:'Segoe UI',Arial,Helvetica,sans-serif";
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#eef3fa;${font};color:#0c1330">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3fa;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #d8def0;border-radius:4px">
<tr><td style="padding:24px 24px 8px;font-family:'Courier New',monospace;font-size:13px;font-weight:bold;color:#0f62d6">topa? · aviso que você pediu</td></tr>
<tr><td style="padding:0 24px"><h1 style="margin:8px 0 6px;font-size:22px;line-height:28px">${escapeHtml(o.title)} abriu as inscrições</h1>
${o.organizer ? `<p style="margin:0;color:#52608a;font-size:14px">${escapeHtml(o.organizer)}</p>` : ""}
${o.benefits.length > 0 ? `<p style="margin:14px 0 0;padding:4px 10px;border-left:2px solid #0f62d6;background:#e2eeff;font-size:14px;font-weight:600">${escapeHtml(o.benefits.join(" · "))}</p>` : ""}
<p style="margin:14px 0 0;font-size:15px">${escapeHtml(deadline)}</p></td></tr>
<tr><td style="padding:20px 24px 8px"><a href="${escapeHtml(o.officialUrl)}" style="display:inline-block;background:#0c1330;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 18px;border-radius:3px">Ir para a página oficial</a></td></tr>
<tr><td style="padding:4px 24px 24px;font-size:13px;color:#52608a"><a href="${escapeHtml(page)}" style="color:#0f62d6">Ver no Topa?</a> · Este aviso vem uma vez só. Para receber de novo, ligue o aviso outra vez no site.</td></tr>
</table></td></tr></table></body></html>`;

  return { subject, html, text };
}
