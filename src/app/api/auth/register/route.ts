import { mutateDb, newId } from "@/lib/db";
import { hashPassword, normaliseUsername, setSession } from "@/lib/auth";
import { fail, readJson, stateResponse } from "@/lib/api";
import { nowWith } from "@/lib/time";

export const dynamic = "force-dynamic";

interface Body {
  username: string;
  displayName: string;
  password: string;
}

export async function POST(request: Request) {
  const body = await readJson<Body>(request);
  const username = normaliseUsername(body.username ?? "");
  const displayName = (body.displayName ?? "").trim() || body.username?.trim() || "";
  const password = body.password ?? "";

  if (!/^[a-z0-9_.-]{3,20}$/.test(username)) {
    return fail("Username must be 3-20 characters: letters, numbers, . _ or -");
  }
  if (displayName.length < 1 || displayName.length > 24) {
    return fail("Camp name must be 1-24 characters");
  }
  if (password.length < 4) {
    return fail("Password must be at least 4 characters");
  }

  const result = await mutateDb((db) => {
    if (db.users.some((u) => u.username === username)) return null;
    const { salt, passwordHash } = hashPassword(password);
    const user = {
      id: newId("usr"),
      username,
      displayName,
      salt,
      passwordHash,
      campsiteId: null,
      createdAt: nowWith(db.dev.timeOffsetMs),
    };
    db.users.push(user);
    return user;
  });

  if (!result) return fail("That username is already taken", 409);

  await setSession(result.id);
  return stateResponse(result.id);
}
