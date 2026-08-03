import { mutateDb } from "@/lib/db";
import { requireUser, stateResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST() {
  const { user, response } = await requireUser();
  if (!user) return response;

  await mutateDb((db) => {
    const me = db.users.find((u) => u.id === user.id);
    if (me) me.campsiteId = null;
  });

  return stateResponse(user.id);
}
