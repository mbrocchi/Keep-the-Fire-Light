import { mutateDb, newId } from "@/lib/db";
import { fail, readJson, requireUser, stateResponse } from "@/lib/api";
import { dayKeyOf, nowWith } from "@/lib/time";
import { wordForDay } from "@/lib/words";
import { isValidGuess, markGuess, MAX_GUESSES } from "@/lib/wordle";
import { stoke } from "@/lib/fire";
import type { Game } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Guesses are graded on the server and only the marks come back, so the answer
 * never reaches the client while a game is in progress. It also means a board
 * survives a refresh, and follows you between phone and laptop.
 */
export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const body = await readJson<{ guess: string }>(request);
  const guess = (body.guess ?? "").trim().toUpperCase();
  if (!isValidGuess(guess)) return fail("Guesses are five letters");

  const outcome = await mutateDb((db) => {
    const at = nowWith(db.dev.timeOffsetMs);
    const dayKey = dayKeyOf(at);
    const answer = wordForDay(at);
    const me = db.users.find((u) => u.id === user.id);
    if (!me) return { error: "Account not found" } as const;

    let game = db.games.find((g) => g.userId === me.id && g.dayKey === dayKey);
    if (!game) {
      game = {
        id: newId("gam"),
        userId: me.id,
        campsiteId: me.campsiteId,
        dayKey,
        guesses: [],
        marks: [],
        status: "playing",
        completedAt: null,
        stoked: false,
      } satisfies Game;
      db.games.push(game);
    }

    if (game.status !== "playing") return { error: "Today's puzzle is already finished" } as const;
    if (game.guesses.length >= MAX_GUESSES) return { error: "No guesses left today" } as const;

    // The campsite can change between days; keep the game attached to today's.
    game.campsiteId = me.campsiteId;
    game.guesses.push(guess);
    game.marks.push(markGuess(guess, answer));

    if (guess === answer) game.status = "won";
    else if (game.guesses.length >= MAX_GUESSES) game.status = "lost";
    if (game.status !== "playing") game.completedAt = at;

    // Solving stokes the shared fire immediately — the message is optional.
    let stoked = false;
    if (game.status === "won" && !game.stoked) {
      const campsite = db.campsites.find((c) => c.id === me.campsiteId);
      if (campsite) {
        campsite.fire = stoke(campsite.fire, at);
        game.stoked = true;
        stoked = true;
      }
    }

    return { error: null, stoked, status: game.status } as const;
  });

  if (outcome.error) return fail(outcome.error, 409);
  return stateResponse(user.id, { stoked: outcome.stoked });
}
