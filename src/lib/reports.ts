// "Reportar erro": what a report can say, and how new reports become a GitHub issue.
// Stored in public.reports (migration 0006) without any identification of who sent it.

export const REPORT_REASONS = [
  { id: "wrong_date", label: "Data ou prazo errado" },
  { id: "broken_link", label: "Link quebrado" },
  { id: "closed", label: "Já encerrou ou foi cancelado" },
  { id: "wrong_requirements", label: "Requisitos errados (idade, nível, país)" },
  { id: "duplicate", label: "Está duplicado" },
  { id: "other", label: "Outro problema" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["id"];

export const REPORT_MESSAGE_MAX = 500;
/** One report per item per browser in this window, against accidental repeats. */
export const REPORT_COOLDOWN_MS = 10 * 60_000;

export type ReportRow = { item_key: string; reason: ReportReason; message: string | null };

export function validateReport(input: {
  itemKey: string;
  reason: string;
  message: string;
}): { ok: true; report: ReportRow } | { ok: false; error: string } {
  const reason = REPORT_REASONS.find((r) => r.id === input.reason)?.id;
  if (!reason) return { ok: false, error: "Escolha o que está errado." };
  const message = input.message.trim();
  if (message.length > REPORT_MESSAGE_MAX) return { ok: false, error: `Use até ${REPORT_MESSAGE_MAX} caracteres.` };
  if (reason === "other" && !message) return { ok: false, error: "Conte em poucas palavras o que está errado." };
  return { ok: true, report: { item_key: input.itemKey, reason, message: message || null } };
}

export function canReportAgain(lastReportedAt: number | null, now: number): boolean {
  return lastReportedAt === null || now - lastReportedAt >= REPORT_COOLDOWN_MS;
}

export type StoredReport = ReportRow & { id: number; created_at: string };

const reasonLabel = (id: string) => REPORT_REASONS.find((r) => r.id === id)?.label ?? id;

/** Markdown for the GitHub issue. Messages are quoted and @mentions defused: they are user text. */
export function formatReportIssue(reports: StoredReport[], siteUrl: string): string {
  const lines = [
    "Novos reportes de erro enviados pelo site. Confira cada item na página oficial e corrija a fonte",
    "(ou o YAML, no caso de itens curados).",
    "",
  ];
  for (const r of reports) {
    const link = `${siteUrl}/#o=${encodeURIComponent(r.item_key)}`;
    lines.push(`- **${reasonLabel(r.reason)}** em [${r.item_key}](${link}), ${r.created_at.slice(0, 16).replace("T", " ")} UTC`);
    if (r.message) {
      const quoted = r.message
        .replace(/@/g, "`@`")
        .split(/\r?\n/)
        .map((l) => `  > ${l}`)
        .join("\n");
      lines.push(quoted);
    }
  }
  return lines.join("\n") + "\n";
}
