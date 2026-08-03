import { readDb } from "./db";

export const DAY_MS = 86_400_000;

/**
 * THE ONE RULE OF THIS CODEBASE: every time-dependent read goes through here.
 *
 * The Settings screen can push the whole world forward so fire decay and the
 * daily puzzle reset can be tested without waiting. A raw `Date.now()` anywhere
 * else silently breaks that, in ways that look like real bugs.
 */
export async function now(): Promise<number> {
  const db = await readDb();
  return Date.now() + db.dev.timeOffsetMs;
}

/** Synchronous variant for code already holding the db inside `mutateDb`. */
export function nowWith(offsetMs: number): number {
  return Date.now() + offsetMs;
}

/** `YYYY-MM-DD` in UTC — the identity of a puzzle day. */
export function dayKeyOf(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** Whole UTC days since the epoch — used to pick the daily word. */
export function dayNumberOf(ts: number): number {
  return Math.floor(ts / DAY_MS);
}

/** Milliseconds until the next UTC midnight, i.e. the next word. */
export function msUntilNextDay(ts: number): number {
  return DAY_MS - (((ts % DAY_MS) + DAY_MS) % DAY_MS);
}
