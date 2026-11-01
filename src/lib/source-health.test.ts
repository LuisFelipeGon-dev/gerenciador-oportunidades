import { describe, expect, it } from "vitest";
import { FAILURES_TO_ALERT, nextHealth, sourcesToAlert, type SourceHealthRow } from "./source-health";

const now = new Date("2026-11-02T12:00:00.000Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

function row(source: string, overrides: Partial<SourceHealthRow> = {}): SourceHealthRow {
  return { source, failures: 0, last_ok_at: hoursAgo(1), last_error: null, updated_at: hoursAgo(1), ...overrides };
}

describe("nextHealth", () => {
  it("resets the count when the run works", () => {
    expect(nextHealth({ failures: 2, last_ok_at: null }, "ufmt", null, now)).toEqual({
      source: "ufmt",
      failures: 0,
      last_ok_at: now.toISOString(),
      last_error: null,
      updated_at: now.toISOString(),
    });
  });

  it("counts failures in a row and keeps the last success", () => {
    const first = nextHealth(null, "ufmt", "timeout", now);
    expect(first.failures).toBe(1);
    expect(first.last_ok_at).toBeNull();
    const second = nextHealth({ failures: 1, last_ok_at: hoursAgo(30) }, "ufmt", "timeout", now);
    expect(second).toMatchObject({ failures: 2, last_ok_at: hoursAgo(30), last_error: "timeout" });
  });

  it("cuts long error messages", () => {
    expect(nextHealth(null, "x", "e".repeat(5000), now).last_error).toHaveLength(1000);
  });
});

describe("sourcesToAlert", () => {
  it("is quiet while failures are below the limit", () => {
    const rows = [row("devpost"), row("ufmt", { failures: FAILURES_TO_ALERT - 1, last_error: "403" })];
    expect(sourcesToAlert(rows, ["devpost", "ufmt"], now)).toEqual([]);
  });

  it("reports a source that keeps failing", () => {
    const rows = [row("ufmt", { failures: FAILURES_TO_ALERT, last_error: "403 Forbidden" })];
    expect(sourcesToAlert(rows, ["ufmt"], now)).toEqual(["ufmt: failed 3 runs in a row (403 Forbidden)"]);
  });

  it("reports a source that stopped being collected or never was", () => {
    expect(sourcesToAlert([row("ufmt", { updated_at: hoursAgo(50) })], ["ufmt", "devevents"], now)).toEqual([
      "ufmt: not collected for 50 hours",
      "devevents: never collected",
    ]);
  });

  it("ignores rows of sources that are not expected", () => {
    expect(sourcesToAlert([row("old", { failures: 9 })], [], now)).toEqual([]);
  });
});
