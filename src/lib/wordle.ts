import type { Mark } from "./types";

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

/** Per the agreed design, any five letters are accepted — no dictionary. */
export function isValidGuess(guess: string): boolean {
  return new RegExp(`^[A-Za-z]{${WORD_LENGTH}}$`).test(guess);
}

/**
 * Standard two-pass marking.
 *
 * Greens are claimed first and their letters removed from a tally of what the
 * answer still has left; only then are yellows handed out from that tally. The
 * order matters for repeated letters — guessing LLAMA against FLAME must give
 * exactly one yellow L, not two.
 */
export function markGuess(guess: string, answer: string): Mark[] {
  const g = guess.toUpperCase();
  const a = answer.toUpperCase();
  const marks: Mark[] = new Array(g.length).fill("absent");

  const remaining = new Map<string, number>();
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

const RANK: Record<Mark, number> = { absent: 0, present: 1, correct: 2 };

/** Best state seen for each letter, for colouring the on-screen keyboard. */
export function keyboardState(guesses: string[], marks: Mark[][]): Record<string, Mark> {
  const state: Record<string, Mark> = {};
  guesses.forEach((guess, row) => {
    guess.toUpperCase().split("").forEach((letter, col) => {
      const mark = marks[row]?.[col];
      if (!mark) return;
      const prev = state[letter];
      if (!prev || RANK[mark] > RANK[prev]) state[letter] = mark;
    });
  });
  return state;
}

/** Emoji grid for sharing, in the game's own colours. */
export function shareGrid(marks: Mark[][]): string {
  return marks
    .map((row) =>
      row.map((m) => (m === "correct" ? "🟩" : m === "present" ? "🟨" : "⬛")).join("")
    )
    .join("\n");
}
