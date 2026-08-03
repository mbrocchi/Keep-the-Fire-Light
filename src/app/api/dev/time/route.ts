import { mutateDb } from "@/lib/db";
import { readJson, requireUser, stateResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Testing aid: shifts the whole world forward so fire decay and the daily
 * puzzle reset can be watched without waiting a real day. Shared across every
 * member, because the interesting behaviour is the shared fire.
 */
export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const body = await readJson<{ advanceMs: number; reset: boolean }>(request);

  await mutateDb((db) => {
    if (body.reset) db.dev.timeOffsetMs = 0;
    else if (Number.isFinite(body.advanceMs)) {
      db.dev.timeOffsetMs = Math.max(0, db.dev.timeOffsetMs + Number(body.advanceMs));
    }
  });

  return stateResponse(user.id);
}
