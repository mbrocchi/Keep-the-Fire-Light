import { readDb } from "@/lib/db";
import { normaliseUsername, setSession, verifyPassword } from "@/lib/auth";
import { fail, readJson, stateResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

interface Body {
  username: string;
  password: string;
}

export async function POST(request: Request) {
  const body = await readJson<Body>(request);
  const username = normaliseUsername(body.username ?? "");
  const password = body.password ?? "";

  const db = await readDb();
  const user = db.users.find((u) => u.username === username);

  // Same message either way, so this can't be used to enumerate usernames.
  if (!user || !verifyPassword(password, user)) {
    return fail("That username and password don't match", 401);
  }

  await setSession(user.id);
  return stateResponse(user.id);
}
