import type { Db, Game } from "./types";
import type { CampState, PublicGame } from "./shared";
import { currentIntensity, hoursRemaining, tierOf } from "./fire";
import { dayKeyOf, msUntilNextDay } from "./time";
import { MAX_GUESSES } from "./wordle";

export type { CampState, PublicGame };

export function publicGame(game: Game | undefined, dayKey: string, answer: string, posted: boolean): PublicGame {
  if (!game) {
    return { dayKey, guesses: [], marks: [], status: "playing", answer: null, hasPosted: false };
  }
  return {
    dayKey: game.dayKey,
    guesses: game.guesses,
    marks: game.marks,
    status: game.status,
    answer: game.status === "playing" ? null : answer,
    hasPosted: posted,
  };
}

/** How many consecutive days ending today the camp has posted at least once. */
function daysLit(db: Db, campsiteId: string, todayKey: string): number {
  const posted = new Set(
    db.messages.filter((m) => m.campsiteId === campsiteId).map((m) => m.dayKey)
  );
  const solved = new Set(
    db.games
      .filter((g) => g.campsiteId === campsiteId && g.status === "won")
      .map((g) => g.dayKey)
  );
  let streak = 0;
  const cursor = new Date(`${todayKey}T00:00:00.000Z`);
  // Today not yet solved shouldn't break a streak that's alive from yesterday.
  if (!posted.has(todayKey) && !solved.has(todayKey)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  for (;;) {
    const key = dayKeyOf(cursor.getTime());
    if (!posted.has(key) && !solved.has(key)) break;
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export function buildCampState(
  db: Db,
  userId: string,
  at: number,
  answer: string
): CampState | null {
  const user = db.users.find((u) => u.id === userId);
  if (!user) return null;

  const dayKey = dayKeyOf(at);
  const campsite = db.campsites.find((c) => c.id === user.campsiteId) ?? null;

  const myGame = db.games.find((g) => g.userId === user.id && g.dayKey === dayKey);
  const myMessage = db.messages.find((m) => m.userId === user.id && m.dayKey === dayKey);

  const members = campsite
    ? db.users
        .filter((u) => u.campsiteId === campsite.id)
        .map((u) => ({
          id: u.id,
          displayName: u.displayName,
          solvedToday: db.games.some(
            (g) => g.userId === u.id && g.dayKey === dayKey && g.status === "won"
          ),
          isYou: u.id === user.id,
        }))
        .sort((a, b) => Number(b.solvedToday) - Number(a.solvedToday) || a.displayName.localeCompare(b.displayName))
    : [];

  const messages = campsite
    ? db.messages
        .filter((m) => m.campsiteId === campsite.id && m.dayKey === dayKey)
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((m) => ({
          id: m.id,
          author: db.users.find((u) => u.id === m.userId)?.displayName ?? "Someone",
          text: m.text,
          createdAt: m.createdAt,
          isYou: m.userId === user.id,
        }))
    : [];

  let campsiteView: CampState["campsite"] = null;
  if (campsite) {
    const intensity = currentIntensity(campsite.fire, at);
    const tier = tierOf(intensity);
    campsiteView = {
      id: campsite.id,
      code: campsite.code,
      name: campsite.name,
      intensity,
      tier: tier.key,
      tierLabel: tier.label,
      tierBlurb: tier.blurb,
      hoursRemaining: hoursRemaining(intensity),
      daysLit: daysLit(db, campsite.id, dayKey),
    };
  }

  return {
    user: { id: user.id, username: user.username, displayName: user.displayName },
    campsite: campsiteView,
    members,
    game: publicGame(myGame, dayKey, answer, Boolean(myMessage)),
    messages,
    dayKey,
    msUntilNextWord: msUntilNextDay(at),
    timeOffsetMs: db.dev.timeOffsetMs,
    serverTime: at,
  };
}

export const MAX_ATTEMPTS = MAX_GUESSES;
