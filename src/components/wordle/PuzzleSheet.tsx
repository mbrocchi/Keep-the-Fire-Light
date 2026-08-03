"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Board, { REVEAL_TOTAL } from "./Board";
import Keyboard from "./Keyboard";
import CopyButton from "@/components/CopyButton";
import { call } from "@/lib/useCamp";
import { MAX_MESSAGE_LENGTH, type ApiResult, type CampState } from "@/lib/shared";
import { keyboardState, shareGrid, WORD_LENGTH, MAX_GUESSES } from "@/lib/wordle";
import type { Mark } from "@/lib/types";

interface Props {
  state: CampState;
  onState: (result: ApiResult) => void;
  onClose: () => void;
}

/**
 * Full-viewport puzzle.
 *
 * Deliberately not inside the artwork frame: a 768x1376 stage is too short for
 * six rows plus a keyboard on a tall phone, and the keyboard needs every pixel
 * of height it can get.
 */
export default function PuzzleSheet({ state, onState, onClose }: Props) {
  const game = state.game;

  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [animatingRow, setAnimatingRow] = useState<number | null>(null);
  /** How many rows the player has actually watched turn over. */
  const [revealed, setRevealed] = useState(game.guesses.length);
  const [showResult, setShowResult] = useState(game.status !== "playing");
  const [message, setMessage] = useState("");
  const [posted, setPosted] = useState(game.hasPosted);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach(window.clearTimeout);
  }, []);

  const flash = useCallback((text: string) => {
    setNotice(text);
    setShake(true);
    timers.current.push(window.setTimeout(() => setShake(false), 560));
    timers.current.push(window.setTimeout(() => setNotice(null), 2000));
  }, []);

  const submit = useCallback(async () => {
    if (busy || game.status !== "playing" || animatingRow !== null) return;
    if (draft.length !== WORD_LENGTH) {
      flash(`${WORD_LENGTH} letters, please`);
      return;
    }

    setBusy(true);
    const result = await call("/api/game/guess", { guess: draft });
    setBusy(false);

    if (!result.ok) {
      flash(result.error);
      return;
    }

    const next = result.state;
    if (!next) return;

    const row = next.game.guesses.length - 1;
    setDraft("");
    onState(result);
    setAnimatingRow(row);

    // Hold the keyboard colours and the result panel back until the tiles have
    // finished turning over, so nothing spoils the reveal.
    timers.current.push(
      window.setTimeout(() => {
        setAnimatingRow(null);
        setRevealed(row + 1);
        if (next.game.status !== "playing") {
          timers.current.push(window.setTimeout(() => setShowResult(true), 320));
        }
      }, REVEAL_TOTAL)
    );
  }, [busy, draft, flash, game.status, animatingRow, onState]);

  const press = useCallback(
    (key: string) => {
      if (game.status !== "playing" || animatingRow !== null) return;
      if (key === "↵") return void submit();
      if (key === "⌫") return setDraft((d) => d.slice(0, -1));
      if (/^[A-Z]$/.test(key)) setDraft((d) => (d.length < WORD_LENGTH ? d + key : d));
    },
    [game.status, animatingRow, submit]
  );

  // A physical keyboard should work too — most families have one laptop player.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (showResult) return;
      if (e.key === "Enter") press("↵");
      else if (e.key === "Backspace") press("⌫");
      else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toUpperCase());
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [press, showResult]);

  async function postMessage() {
    if (busy || !message.trim()) return;
    setBusy(true);
    const result = await call("/api/message", { text: message });
    setBusy(false);
    if (!result.ok) return flash(result.error);
    onState(result);
    setPosted(true);
    timers.current.push(window.setTimeout(onClose, 700));
  }

  const visibleMarks: Mark[][] = game.marks.slice(0, Math.max(revealed, 0));
  const keys = keyboardState(game.guesses.slice(0, revealed), visibleMarks);
  const won = game.status === "won";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0b1c24]/97 backdrop-blur-md">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 50% at 50% 108%, rgba(226,110,40,0.28), transparent 70%)",
        }}
      />

      {/* Header */}
      <header className="relative flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          onClick={onClose}
          className="btn btn-sm btn-quiet"
          aria-label="Back to camp"
        >
          ← Camp
        </button>
        <div className="text-center">
          <p className="display text-sm uppercase tracking-[0.18em] text-cream/90">
            Today&apos;s Word
          </p>
          <p className="text-[0.68rem] uppercase tracking-[0.16em] text-cream/45">
            {state.dayKey}
          </p>
        </div>
        <span className="w-[5.5rem] text-right text-xs text-cream/50">
          {Math.max(0, MAX_GUESSES - game.guesses.length)} left
        </span>
      </header>

      {/* Board */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 py-3">
        <Board
          guesses={game.guesses}
          marks={game.marks}
          draft={draft}
          animatingRow={animatingRow}
          shake={shake}
        />
        {notice && (
          <p
            role="status"
            className="absolute top-2 left-1/2 -translate-x-1/2 rounded-full bg-cream px-4 py-1.5 text-sm font-semibold text-ink shadow-lg"
          >
            {notice}
          </p>
        )}
      </div>

      {/* Keyboard */}
      <div className="relative px-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <Keyboard
          state={keys}
          onKey={press}
          disabled={busy || game.status !== "playing" || animatingRow !== null}
        />
      </div>

      {showResult && (
        <ResultPanel
          won={won}
          answer={game.answer}
          marks={game.marks}
          guessCount={game.guesses.length}
          campName={state.campsite?.name ?? "camp"}
          message={message}
          setMessage={setMessage}
          posted={posted}
          busy={busy}
          onPost={postMessage}
          onClose={onClose}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

interface ResultProps {
  won: boolean;
  answer: string | null;
  marks: Mark[][];
  guessCount: number;
  campName: string;
  message: string;
  setMessage: (v: string) => void;
  posted: boolean;
  busy: boolean;
  onPost: () => void;
  onClose: () => void;
}

function ResultPanel({
  won,
  answer,
  marks,
  guessCount,
  campName,
  message,
  setMessage,
  posted,
  busy,
  onPost,
  onClose,
}: ResultProps) {
  const remaining = MAX_MESSAGE_LENGTH - message.length;
  const share = `Keep The Fire Light — ${guessCount}/${MAX_GUESSES}\n\n${shareGrid(marks)}`;

  return (
    <div className="absolute inset-0 z-10 flex items-end justify-center bg-black/55 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
      <div className="patch w-full max-w-[26rem] rise p-5 pb-6">
        <div className="text-center">
          <p className="display text-xl uppercase tracking-[0.1em] text-cream lit">
            {won ? "The fire takes" : "It went out"}
          </p>
          <p className="mt-1.5 text-sm text-cream/70">
            {won ? (
              <>
                Solved in {guessCount}/{MAX_GUESSES}. You&apos;ve stoked the fire at{" "}
                <span className="text-gold">{campName}</span>.
              </>
            ) : (
              <>
                The word was{" "}
                <span className="text-gold tracking-[0.14em]">{answer}</span>. The fire keeps
                burning down — there&apos;s a new word tomorrow.
              </>
            )}
          </p>
        </div>

        {won && !posted && (
          <div className="mt-4">
            <label className="mb-1.5 flex items-baseline justify-between text-xs uppercase tracking-[0.14em] text-cream/60">
              <span>Leave a note in the logbook</span>
              <span className={remaining < 0 ? "text-ember" : "text-cream/40"}>{remaining}</span>
            </label>
            <textarea
              className="field resize-none"
              rows={3}
              maxLength={MAX_MESSAGE_LENGTH}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Thinking of you all today. Rain here, but the kettle's on."
              autoFocus
            />
            <div className="mt-3 flex gap-2">
              <button onClick={onClose} className="btn btn-sm btn-quiet flex-1">
                Skip
              </button>
              <button
                onClick={onPost}
                disabled={busy || !message.trim()}
                className="btn btn-sm btn-ember flex-[2]"
              >
                {busy ? "Sending…" : "Add to Logbook"}
              </button>
            </div>
          </div>
        )}

        {(posted || !won) && (
          <div className="mt-4 flex gap-2">
            <CopyButton value={share} label="Copy Result" className="flex-1" />
            <button onClick={onClose} className="btn btn-sm btn-ember flex-1">
              Back to the Fire
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
