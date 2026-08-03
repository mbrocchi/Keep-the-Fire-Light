import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { readDb } from "./db";
import type { User } from "./types";

export const SESSION_COOKIE = "ktfl_session";

/**
 * The signing secret lives outside the repo. It is generated on first run so
 * there is nothing to configure before `npm run dev` works.
 */
function secret(): string {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv) return fromEnv;

  const file = path.join(process.cwd(), "data", ".secret");
  try {
    return readFileSync(file, "utf8").trim();
  } catch {
    const generated = randomBytes(32).toString("hex");
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, generated, "utf8");
    return generated;
  }
}

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return { salt, passwordHash: scryptSync(password, salt, 64).toString("hex") };
}

export function verifyPassword(password: string, user: Pick<User, "salt" | "passwordHash">) {
  const candidate = scryptSync(password, user.salt, 64);
  const stored = Buffer.from(user.passwordHash, "hex");
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createToken(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

export function readToken(token: string | undefined): string | null {
  if (!token) return null;
  const cut = token.lastIndexOf(".");
  if (cut < 1) return null;
  const userId = token.slice(0, cut);
  const provided = Buffer.from(token.slice(cut + 1));
  const expected = Buffer.from(sign(userId));
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  return userId;
}

/**
 * `secure` is deliberately off: the whole point is playing from phones on the
 * LAN over plain HTTP, where a Secure cookie would never be sent back.
 */
export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: false,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

export async function setSession(userId: string) {
  (await cookies()).set(SESSION_COOKIE, createToken(userId), COOKIE_OPTIONS);
}

export async function clearSession() {
  (await cookies()).set(SESSION_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
}

/** The signed-in user, or null. */
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const userId = readToken(token);
  if (!userId) return null;
  const db = await readDb();
  return db.users.find((u) => u.id === userId) ?? null;
}

export function normaliseUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

// Excludes 0/O/1/I/L so a code read aloud or texted can't be mistyped.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateCampsiteCode(taken: Set<string>): string {
  for (let attempt = 0; attempt < 200; attempt++) {
    let code = "";
    const bytes = randomBytes(6);
    for (let i = 0; i < 6; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    if (!taken.has(code)) return code;
  }
  throw new Error("Could not generate a unique campsite code");
}

export function normaliseCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
