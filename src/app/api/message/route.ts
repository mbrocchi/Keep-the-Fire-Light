import { mutateDb, newId } from "@/lib/db";
import { fail, readJson, requireUser, stateResponse } from "@/lib/api";
import { dayKeyOf, nowWith } from "@/lib/time";
import { MAX_MESSAGE_LENGTH } from "@/lib/shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const body = await readJson<{ text: string }>(request);
  const text = (body.text ?? "").trim().replace(/\s+/g, " ");
  if (!text) return fail("Write something first");
  if (text.length > MAX_MESSAGE_LENGTH) {
    return fail(`Keep it to ${MAX_MESSAGE_LENGTH} characters`);
  }

  const error = await mutateDb((db) => {
    const at = nowWith(db.dev.timeOffsetMs);
    const dayKey = dayKeyOf(at);
    const me = db.users.find((u) => u.id === user.id);
    if (!me?.campsiteId) return "Join a campsite first";

    const solved = db.games.some(
      (g) => g.userId === me.id && g.dayKey === dayKey && g.status === "won"
    );
    if (!solved) return "Solve today's puzzle before writing in the logbook";

    const existing = db.messages.find((m) => m.userId === me.id && m.dayKey === dayKey);
    if (existing) {
      existing.text = text;
      existing.createdAt = at;
      return null;
    }

    db.messages.push({
      id: newId("msg"),
      userId: me.id,
      campsiteId: me.campsiteId,
      dayKey,
      text,
      createdAt: at,
    });
    return null;
  });

  if (error) return fail(error, 409);
  return stateResponse(user.id);
}
