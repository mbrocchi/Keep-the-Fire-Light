import { NextResponse } from "next/server";
import { readDb } from "./db";
import { nowWith } from "./time";
import { wordForDay } from "./words";
import { buildCampState } from "./state";
import { currentUser } from "./auth";

export function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function readJson<T>(request: Request): Promise<Partial<T>> {
  try {
    return (await request.json()) as Partial<T>;
  } catch {
    return {};
  }
}

/** The standard success shape: every mutating route returns fresh camp state. */
export async function stateResponse(userId: string, extra: Record<string, unknown> = {}) {
  const db = await readDb();
  const at = nowWith(db.dev.timeOffsetMs);
  const state = buildCampState(db, userId, at, wordForDay(at));
  if (!state) return fail("Account not found", 401);
  return NextResponse.json({ ok: true, state, ...extra });
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) return { user: null as null, response: fail("Not signed in", 401) };
  return { user, response: null };
}
