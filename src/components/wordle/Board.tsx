"use client";

import type { Mark } from "@/lib/types";
import { MAX_GUESSES, WORD_LENGTH } from "@/lib/wordle";

interface Props {
  guesses: string[];
  marks: Mark[][];
  draft: string;
  /** Row currently playing its flip-reveal, or null. */
  animatingRow: number | null;
  shake: boolean;
}

export const REVEAL_STAGGER = 230;
export const REVEAL_DURATION = 540;
export const REVEAL_TOTAL = REVEAL_STAGGER * (WORD_LENGTH - 1) + REVEAL_DURATION;

const FINAL: Record<Mark, string> = {
  correct: "linear-gradient(168deg,#65984a,#41682e)",
  present: "linear-gradient(168deg,#e0a83c,#b47c1c)",
  absent: "linear-gradient(168deg,#3d4b53,#28323a)",
};

export default function Board({ guesses, marks, draft, animatingRow, shake }: Props) {
  const rows = Array.from({ length: MAX_GUESSES }, (_, row) => {
    const submitted = row < guesses.length;
    const letters = submitted
      ? guesses[row].split("")
      : row === guesses.length
        ? draft.padEnd(WORD_LENGTH, " ").split("")
        : new Array(WORD_LENGTH).fill(" ");

    return { row, submitted, letters, rowMarks: marks[row] };
  });

  return (
    <div
      className="mx-auto grid w-full max-w-[min(21rem,72vh*0.44)] gap-1.5"
      style={{ gridTemplateRows: `repeat(${MAX_GUESSES}, 1fr)` }}
    >
      {rows.map(({ row, submitted, letters, rowMarks }) => (
        <div
          key={row}
          className={`grid gap-1.5 ${shake && row === guesses.length ? "shake" : ""}`}
          style={{ gridTemplateColumns: `repeat(${WORD_LENGTH}, 1fr)` }}
        >
          {letters.map((letter, col) => {
            const mark = submitted ? rowMarks?.[col] : undefined;
            const animating = animatingRow === row;
            const settled = submitted && !animating;
            const typed = letter.trim().length > 0;

            return (
              <div
                key={col}
                className="relative flex aspect-square items-center justify-center rounded-md border-2 text-[clamp(1.1rem,6vw,1.9rem)] uppercase"
                style={{
                  fontFamily: "var(--font-display)",
                  perspective: "600px",
                  transformStyle: "preserve-3d",
                  ...(settled && mark
                    ? {
                        background: FINAL[mark],
                        borderColor: "transparent",
                        color: "#fdf6e6",
                      }
                    : {
                        background: "rgba(9,26,32,0.55)",
                        borderColor: typed
                          ? "rgba(245,234,210,0.5)"
                          : "rgba(245,234,210,0.18)",
                        color: "#f5ead2",
                      }),
                  ...(animating && mark
                    ? {
                        // Colour swaps at the midpoint of the flip, so each tile
                        // turns over to show its answer.
                        ["--tile-final" as string]: FINAL[mark],
                        animation: `ktfl-reveal ${REVEAL_DURATION}ms ease forwards`,
                        animationDelay: `${col * REVEAL_STAGGER}ms`,
                      }
                    : {}),
                  ...(typed && !submitted ? { animation: "ktfl-pop 140ms ease-out" } : {}),
                }}
              >
                {letter.trim()}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
