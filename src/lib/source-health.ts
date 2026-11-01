// Health of each collection source (table source_health, migration 0011). Sites sometimes block
// or time out for a day; the daily run only fails, and GitHub only emails, when a source keeps
// failing or stops being collected at all.

/** Consecutive failed runs before the daily run fails. */
export const FAILURES_TO_ALERT = 3;
/** A source not collected for this long is reported even without recorded failures. */
export const MAX_AGE_HOURS = 48;

export type SourceHealthRow = {
  source: string;
  failures: number;
  last_ok_at: string | null;
  last_error: string | null;
  updated_at: string;
};

/** Row to store after one run of a source; `error` is null when the run worked. */
export function nextHealth(
  previous: Pick<SourceHealthRow, "failures" | "last_ok_at"> | null,
  source: string,
  error: string | null,
  now: Date,
): SourceHealthRow {
  const at = now.toISOString();
  if (error === null) return { source, failures: 0, last_ok_at: at, last_error: null, updated_at: at };
  return {
    source,
    failures: (previous?.failures ?? 0) + 1,
    last_ok_at: previous?.last_ok_at ?? null,
    last_error: error.slice(0, 1000),
    updated_at: at,
  };
}

/**
 * Sources that need a person: failed FAILURES_TO_ALERT times in a row, or were not collected in
 * MAX_AGE_HOURS (the job that runs them stopped). One line per source, for the log.
 */
export function sourcesToAlert(rows: SourceHealthRow[], expected: string[], now: Date): string[] {
  const bySource = new Map(rows.map((r) => [r.source, r]));
  const alerts: string[] = [];
  for (const source of expected) {
    const row = bySource.get(source);
    if (!row) {
      alerts.push(`${source}: never collected`);
      continue;
    }
    const ageHours = (now.getTime() - Date.parse(row.updated_at)) / 3_600_000;
    if (row.failures >= FAILURES_TO_ALERT) {
      alerts.push(`${source}: failed ${row.failures} runs in a row (${row.last_error ?? "no message"})`);
    } else if (ageHours > MAX_AGE_HOURS) {
      alerts.push(`${source}: not collected for ${Math.floor(ageHours)} hours`);
    }
  }
  return alerts;
}
