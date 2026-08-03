"use client";

import type { CampState } from "@/lib/shared";

interface Props {
  state: CampState;
  onClose: () => void;
}

function timeAgo(createdAt: number, at: number): string {
  const minutes = Math.max(0, Math.round((at - createdAt) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

/**
 * Today's notes, on their own screen.
 *
 * This used to peek from the bottom of the camp screen, but on a phone it stole
 * the space the fire needed and pushed the main button over the fire pit. Given
 * its own full screen it can also breathe — the notes are the warm part of the
 * game and deserve more than a two-line strip.
 */
export default function LogbookScreen({ state, onClose }: Props) {
  const { messages, members, serverTime } = state;
  const waiting = members.filter((m) => !m.solvedToday);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0b1c24]/97 backdrop-blur-md">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 42% at 50% 106%, rgba(226,110,40,0.22), transparent 70%)",
        }}
      />

      <header className="relative flex items-center justify-between gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <button onClick={onClose} className="btn btn-sm btn-quiet" aria-label="Back to camp">
          ← Camp
        </button>
        <div className="text-center">
          <p className="display text-sm uppercase tracking-[0.18em] text-cream/90">Logbook</p>
          <p className="text-[0.68rem] uppercase tracking-[0.16em] text-cream/45">
            {state.dayKey}
          </p>
        </div>
        <span className="w-[5.5rem] text-right text-xs text-cream/50">
          {messages.length} note{messages.length === 1 ? "" : "s"}
        </span>
      </header>

      <div className="thin-scroll relative min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="display text-base uppercase tracking-[0.12em] text-cream/70">
              Nothing written yet
            </p>
            <p className="mt-2 max-w-[20rem] text-sm leading-relaxed text-cream/50">
              Solve today&apos;s word and you can leave a note here for everyone at{" "}
              {state.campsite?.name ?? "camp"}.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((m, i) => (
              <li
                key={m.id}
                className="parchment rise px-4 py-3"
                style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[0.78rem] font-bold uppercase tracking-wide text-ink/80">
                    {m.isYou ? "You" : m.author}
                  </span>
                  <span className="shrink-0 text-[0.68rem] text-ink/45">
                    {timeAgo(m.createdAt, serverTime)}
                  </span>
                </div>
                <p className="mt-1.5 text-[0.95rem] leading-relaxed text-ink/90">{m.text}</p>
              </li>
            ))}
          </ul>
        )}

        {waiting.length > 0 && messages.length > 0 && (
          <p className="mt-5 text-center text-[0.76rem] leading-relaxed text-cream/45">
            Still to play today: {waiting.map((m) => (m.isYou ? "you" : m.displayName)).join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}
