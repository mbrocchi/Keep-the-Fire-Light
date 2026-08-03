// Creates a demo campsite with four members so the member list, the logbook
// and the shared fire have something in them straight away.
//
//   npm run seed        -- adds the demo camp, keeping anything already there
//   npm run seed -- --fresh   -- wipes data/db.json first
//
// Everyone's password is "camp".
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomBytes, scryptSync } from "node:crypto";
import path from "node:path";

const root = process.cwd();
const DB_PATH = path.join(root, "data", "db.json");
const fresh = process.argv.includes("--fresh");

const PASSWORD = "camp";
const CODE = "CAMP77";

const id = (p) => `${p}_${randomBytes(9).toString("base64url")}`;
const hash = (password) => {
  const salt = randomBytes(16).toString("hex");
  return { salt, passwordHash: scryptSync(password, salt, 64).toString("hex") };
};
const dayKey = (ts) => new Date(ts).toISOString().slice(0, 10);

const EMPTY = { users: [], campsites: [], games: [], messages: [], dev: { timeOffsetMs: 0 } };

const db = fresh
  ? structuredClone(EMPTY)
  : await readFile(DB_PATH, "utf8")
      .then((t) => ({ ...structuredClone(EMPTY), ...JSON.parse(t) }))
      .catch(() => structuredClone(EMPTY));

if (db.campsites.some((c) => c.code === CODE)) {
  console.log(`\n  Demo camp ${CODE} already exists — nothing to do.`);
  console.log("  Run `npm run seed -- --fresh` to start over.\n");
  process.exit(0);
}

const now = Date.now() + (db.dev.timeOffsetMs ?? 0);
const today = dayKey(now);

const campsite = {
  id: id("cmp"),
  code: CODE,
  name: "The Whitmore Fire",
  createdBy: "",
  createdAt: now - 6 * 86_400_000,
  // Two members have already solved today, so the fire starts partly stoked.
  fire: { intensity: 68, updatedAt: now - 2 * 3_600_000 },
};

const people = [
  { username: "jo", displayName: "Grandma Jo", solved: true, note: "Rain here all morning, but the kettle's on. Thinking of you all." },
  { username: "marcus", displayName: "Marcus", solved: true, note: "Got it in three. Nell says hello from under the table." },
  { username: "priya", displayName: "Priya", solved: false, note: null },
  { username: "sam", displayName: "Sam", solved: false, note: null },
];

for (const person of people) {
  const user = {
    id: id("usr"),
    username: person.username,
    displayName: person.displayName,
    ...hash(PASSWORD),
    campsiteId: campsite.id,
    createdAt: campsite.createdAt,
  };
  db.users.push(user);
  if (!campsite.createdBy) campsite.createdBy = user.id;

  if (person.solved) {
    db.games.push({
      id: id("gam"),
      userId: user.id,
      campsiteId: campsite.id,
      dayKey: today,
      // Placeholder board: seeded members are scenery, not real play.
      guesses: [],
      marks: [],
      status: "won",
      completedAt: now - 3 * 3_600_000,
      stoked: true,
    });
  }

  if (person.note) {
    db.messages.push({
      id: id("msg"),
      userId: user.id,
      campsiteId: campsite.id,
      dayKey: today,
      text: person.note,
      createdAt: now - 3 * 3_600_000,
    });
  }
}

db.campsites.push(campsite);

await mkdir(path.dirname(DB_PATH), { recursive: true });
await writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");

console.log(`
  Seeded "${campsite.name}"

    Camp code   ${CODE}
    Sign in as  ${people.map((p) => p.username).join(", ")}
    Password    ${PASSWORD}

  Two members have already solved today, so the fire starts at 68/100.
`);
