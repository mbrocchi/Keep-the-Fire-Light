import { readFile, writeFile, rename, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { EMPTY_DB, type Db } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

/**
 * Single-process JSON store.
 *
 * Reads are served from an in-memory cache; writes go through `mutateDb`, which
 * serialises every mutation onto one promise chain so two concurrent requests
 * can never interleave a read-modify-write. Each flush writes a temp file and
 * renames it over the real one, so a crash mid-write cannot truncate the store.
 *
 * Next's dev server hot-reloads modules, which would otherwise reset the cache
 * and the lock on every edit — both are pinned to globalThis to survive that.
 */
interface Store {
  cache: Db | null;
  lock: Promise<unknown>;
  /** mtime of the file as we last wrote or read it. */
  mtimeMs: number;
}

const g = globalThis as unknown as { __ktfl_store?: Store };
const store: Store = (g.__ktfl_store ??= { cache: null, lock: Promise.resolve(), mtimeMs: 0 });

function normalise(raw: unknown): Db {
  const d = (raw ?? {}) as Partial<Db>;
  return {
    users: d.users ?? [],
    campsites: d.campsites ?? [],
    games: d.games ?? [],
    messages: d.messages ?? [],
    dev: { timeOffsetMs: d.dev?.timeOffsetMs ?? 0 },
  };
}

async function currentMtime(): Promise<number> {
  try {
    return (await stat(DB_PATH)).mtimeMs;
  } catch {
    return -1;
  }
}

async function load(): Promise<Db> {
  // The cache is only trusted while the file on disk is the one we last wrote.
  // `npm run seed` and hand edits happen while the dev server is up, and
  // without this check the server would keep serving its stale copy and then
  // flush it straight back over the new file.
  if (store.cache && (await currentMtime()) === store.mtimeMs) {
    return store.cache;
  }

  try {
    const text = await readFile(DB_PATH, "utf8");
    store.cache = normalise(JSON.parse(text));
    store.mtimeMs = await currentMtime();
  } catch {
    store.cache = structuredClone(EMPTY_DB);
    await flush(store.cache);
  }
  return store.cache;
}

async function flush(db: Db): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DB_PATH}.${randomBytes(6).toString("hex")}.tmp`;
  await writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await rename(tmp, DB_PATH);
  store.mtimeMs = await currentMtime();
}

/** Read-only snapshot. Do not mutate the result — use `mutateDb`. */
export async function readDb(): Promise<Db> {
  return load();
}

/**
 * Runs `fn` with exclusive access to the store and persists the result.
 * Whatever `fn` returns is passed back to the caller.
 */
export async function mutateDb<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  const run = store.lock.then(async () => {
    const db = await load();
    const result = await fn(db);
    await flush(db);
    return result;
  });
  // Keep the chain alive even if this mutation throws.
  store.lock = run.catch(() => {});
  return run;
}

export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(9).toString("base64url")}`;
}
