import { mutateDb } from "@/lib/db";
import { normaliseCode } from "@/lib/auth";
import { fail, readJson, requireUser, stateResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const body = await readJson<{ code: string }>(request);
  const code = normaliseCode(body.code ?? "");
  if (code.length !== 6) return fail("A camp code is 6 characters");

  const joined = await mutateDb((db) => {
    const campsite = db.campsites.find((c) => c.code === code);
    if (!campsite) return false;
    const me = db.users.find((u) => u.id === user.id);
    if (me) me.campsiteId = campsite.id;
    return true;
  });

  if (!joined) return fail("No campsite has that code", 404);
  return stateResponse(user.id);
}
