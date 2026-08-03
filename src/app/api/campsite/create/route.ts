import { mutateDb, newId } from "@/lib/db";
import { generateCampsiteCode } from "@/lib/auth";
import { fail, readJson, requireUser, stateResponse } from "@/lib/api";
import { freshFire } from "@/lib/fire";
import { nowWith } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const body = await readJson<{ name: string }>(request);
  const name = (body.name ?? "").trim();
  if (name.length < 1 || name.length > 28) return fail("Campsite name must be 1-28 characters");

  const code = await mutateDb((db) => {
    const at = nowWith(db.dev.timeOffsetMs);
    const taken = new Set(db.campsites.map((c) => c.code));
    const campsite = {
      id: newId("cmp"),
      code: generateCampsiteCode(taken),
      name,
      createdBy: user.id,
      createdAt: at,
      fire: freshFire(at),
    };
    db.campsites.push(campsite);
    const me = db.users.find((u) => u.id === user.id);
    if (me) me.campsiteId = campsite.id;
    return campsite.code;
  });

  return stateResponse(user.id, { code });
}
