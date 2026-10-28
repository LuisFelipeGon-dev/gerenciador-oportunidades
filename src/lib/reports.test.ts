import { describe, expect, it } from "vitest";
import { REPORT_COOLDOWN_MS, canReportAgain, formatReportIssue, validateReport } from "./reports";

describe("validateReport", () => {
  it("accepts a known reason with an optional message", () => {
    expect(validateReport({ itemKey: "luma:evt-1", reason: "wrong_date", message: "" })).toEqual({
      ok: true,
      report: { item_key: "luma:evt-1", reason: "wrong_date", message: null },
    });
  });

  it("trims the message", () => {
    const result = validateReport({ itemKey: "luma:evt-1", reason: "other", message: "  o prazo é dia 5  " });
    expect(result).toMatchObject({ ok: true, report: { message: "o prazo é dia 5" } });
  });

  it("rejects unknown reasons and long messages", () => {
    expect(validateReport({ itemKey: "luma:evt-1", reason: "spam", message: "" })).toMatchObject({ ok: false });
    expect(validateReport({ itemKey: "luma:evt-1", reason: "other", message: "x".repeat(501) })).toMatchObject({ ok: false });
  });

  it("asks for a message when the reason is 'other'", () => {
    expect(validateReport({ itemKey: "luma:evt-1", reason: "other", message: " " })).toMatchObject({ ok: false });
  });
});

describe("canReportAgain", () => {
  it("waits a few minutes between reports of the same item", () => {
    const now = Date.parse("2026-10-28T12:00:00Z");
    expect(canReportAgain(null, now)).toBe(true);
    expect(canReportAgain(now - 60_000, now)).toBe(false);
    expect(canReportAgain(now - REPORT_COOLDOWN_MS, now)).toBe(true);
  });
});

describe("formatReportIssue", () => {
  it("lists each report with its item, reason and message, linking to the site", () => {
    const md = formatReportIssue(
      [
        { id: 1, item_key: "luma:evt-1", reason: "wrong_date", message: "é dia 6", created_at: "2026-10-28T15:00:00Z" },
        { id: 2, item_key: "gdg:devfest", reason: "broken_link", message: null, created_at: "2026-10-28T16:00:00Z" },
      ],
      "https://gerenciador-oportunidades.vercel.app",
    );
    expect(md).toContain("[luma:evt-1](https://gerenciador-oportunidades.vercel.app/#o=luma%3Aevt-1)");
    expect(md).toContain("Data ou prazo errado");
    expect(md).toContain("> é dia 6");
    expect(md).toContain("Link quebrado");
  });

  it("does not let a message break out of its quote", () => {
    const md = formatReportIssue(
      [{ id: 1, item_key: "x:y", reason: "other", message: "linha 1\n# título\n@alguem", created_at: "2026-10-28T15:00:00Z" }],
      "https://site",
    );
    // Indented under the list item, every line stays inside the quote.
    expect(md).toContain("  > linha 1\n  > # título\n  > `@`alguem");
  });
});
