import test from "node:test";
import assert from "node:assert/strict";

/**
 * Mirrors src/lib/wordle.ts markGuess. Kept as a plain copy so the test runs
 * under bare `node --test` without a TypeScript step.
 */
function markGuess(guess, answer) {
  const g = guess.toUpperCase();
  const a = answer.toUpperCase();
  const marks = new Array(g.length).fill("absent");
  const remaining = new Map();

  for (let i = 0; i < a.length; i++) {
    if (g[i] === a[i]) marks[i] = "correct";
    else remaining.set(a[i], (remaining.get(a[i]) ?? 0) + 1);
  }
  for (let i = 0; i < g.length; i++) {
    if (marks[i] === "correct") continue;
    const left = remaining.get(g[i]) ?? 0;
    if (left > 0) {
      marks[i] = "present";
      remaining.set(g[i], left - 1);
    }
  }
  return marks;
}

const C = "correct";
const P = "present";
const A = "absent";

test("an exact match is all green", () => {
  assert.deepEqual(markGuess("FLAME", "FLAME"), [C, C, C, C, C]);
});

test("no shared letters is all grey", () => {
  assert.deepEqual(markGuess("QUILT", "SPARK"), [A, A, A, A, A]);
});

test("a doubled guess letter gets nothing left over once a green claims it", () => {
  // FLAME has one L and the second L is already green, so the first stays grey.
  assert.deepEqual(markGuess("LLAMA", "FLAME"), [A, C, C, C, A]);
});

test("greens are claimed before yellows are handed out", () => {
  // SHEEP has two E's. GEESE's middle E is green, one more E goes yellow, and
  // the third E finds the tally empty.
  assert.deepEqual(markGuess("GEESE", "SHEEP"), [A, P, C, P, A]);
});

test("a repeated letter yellows only as often as the answer allows", () => {
  // EMBER has two E's: one green in place, one left for the guess's second E.
  assert.deepEqual(markGuess("EERIE", "EMBER"), [C, P, P, A, A]);
});

test("all three states can appear in one row", () => {
  assert.deepEqual(markGuess("CRANE", "CANOE"), [C, A, P, P, C]);
});

/* Fire decay, mirroring src/lib/fire.ts. */
const DAY_MS = 86_400_000;
const DECAY_PER_MS = 100 / DAY_MS;
const STOKE = 34;

const currentIntensity = (fire, at) =>
  Math.min(100, Math.max(0, fire.intensity - Math.max(0, at - fire.updatedAt) * DECAY_PER_MS));

const stoke = (fire, at) => ({
  intensity: Math.min(100, currentIntensity(fire, at) + STOKE),
  updatedAt: at,
});

test("a full fire burns out in exactly 24 hours", () => {
  const fire = { intensity: 100, updatedAt: 0 };
  assert.equal(currentIntensity(fire, 0), 100);
  assert.equal(currentIntensity(fire, DAY_MS / 2), 50);
  assert.equal(currentIntensity(fire, DAY_MS), 0);
  assert.equal(currentIntensity(fire, DAY_MS * 3), 0, "never goes negative");
});

test("three solves in one day reach the Roaring tier", () => {
  let fire = { intensity: 0, updatedAt: 0 };
  for (let i = 0; i < 3; i++) fire = stoke(fire, 0);
  assert.equal(fire.intensity, 100, "capped at 100");
});

test("one solve a day settles into a fire that never quite dies", () => {
  let fire = { intensity: 0, updatedAt: 0 };
  for (let day = 0; day < 10; day++) fire = stoke(fire, day * DAY_MS);
  // A day's decay is 100 and a stoke is 34, so a lone player hovers at 34 and
  // the fire is cold by the time they come back — the nudge to invite people.
  assert.equal(fire.intensity, STOKE);
  assert.equal(currentIntensity(fire, 10 * DAY_MS + DAY_MS * 0.34), 0);
});

test("word selection is stable within a UTC day and moves between days", () => {
  const ANSWERS = ["ALPHA", "BRAVO", "CIGAR", "DELTA", "ECHOS", "FLAME", "GRACE"];
  const wordForDay = (ts) => {
    const day = Math.floor(ts / DAY_MS);
    return ANSWERS[(Math.imul(day + 0x9e37, 2654435761) >>> 0) % ANSWERS.length];
  };
  const dayStart = 20_000 * DAY_MS;
  assert.equal(wordForDay(dayStart), wordForDay(dayStart + DAY_MS - 1));
  assert.notEqual(wordForDay(dayStart), wordForDay(dayStart + DAY_MS));
});
