"use client";

import Image from "next/image";
import type { CampState } from "@/lib/shared";
import { formatDuration } from "@/lib/useCamp";

interface Props {
  state: CampState;
  /** Where the day stands. Lives up here so the artwork stays clear below. */
  status: string;
  onSettings: () => void;
}

export default function Hud({ state, status, onSettings }: Props) {
  const camp = state.campsite;
  const intensity = camp?.intensity ?? 0;
  const litMembers = state.members.filter((m) => m.solvedToday).length;

  return (
    <header className="pointer-events-auto px-3 pt-[max(0.6rem,env(safe-area-inset-top))]">
      <div className="patch flex items-center gap-2.5 px-2.5 py-2">
        <Image
          src="/art/logo.png"
          alt=""
          width={800}
          height={793}
          priority
          className="h-10 w-10 shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
        />

        <div className="min-w-0 flex-1">
          <p className="display truncate text-[0.92rem] uppercase leading-tight text-cream lit">
            {camp?.name ?? "No camp yet"}
          </p>
          <p className="truncate text-[0.7rem] text-cream/65">
            <span className="text-gold">{camp?.tierLabel ?? "—"}</span>
            {camp && intensity > 0 && <> · {formatDuration(camp.hoursRemaining * 3_600_000)} left</>}
            {camp && camp.daysLit > 0 && <> · {camp.daysLit}d lit</>}
          </p>

          {/* Fire meter — the same value the flames are drawn from. */}
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/45">
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{
                width: `${Math.max(2, intensity)}%`,
                background: "linear-gradient(90deg,#b03a12,#e2622b 45%,#f2a93b 78%,#ffe9a8)",
                boxShadow: "0 0 calc(10px * var(--fire-glow)) rgba(242,169,59,0.9)",
              }}
            />
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-1">
          <button
            onClick={onSettings}
            aria-label="Camp settings"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-cream/25 bg-black/30 text-lg text-cream/80 transition-colors active:bg-black/50"
          >
            ⚙
          </button>
          <span className="text-[0.62rem] tabular-nums text-cream/50">
            {litMembers}/{state.members.length}
          </span>
        </div>
      </div>

      <p className="mt-1.5 px-1 text-center text-[0.76rem] leading-snug text-cream/80 lit">
        {status}
      </p>

      {state.timeOffsetMs > 0 && (
        <p className="mt-1.5 text-center text-[0.66rem] uppercase tracking-[0.16em] text-gold/90">
          ⏱ Time travel active · +{formatDuration(state.timeOffsetMs)}
        </p>
      )}
    </header>
  );
}
