"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CopyButton from "@/components/CopyButton";
import { call, formatDuration } from "@/lib/useCamp";
import type { ApiResult, CampState } from "@/lib/shared";

interface Props {
  state: CampState;
  onState: (result: ApiResult) => void;
  onClose: () => void;
  onOpenLogbook: () => void;
}

const HOUR = 3_600_000;

const JUMPS = [
  { label: "+1 hour", ms: HOUR },
  { label: "+6 hours", ms: 6 * HOUR },
  { label: "+24 hours", ms: 24 * HOUR },
];

export default function SettingsModal({ state, onState, onClose, onOpenLogbook }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const camp = state.campsite;

  async function travel(body: { advanceMs?: number; reset?: boolean }) {
    if (busy) return;
    setBusy(true);
    onState(await call("/api/dev/time", body));
    setBusy(false);
  }

  async function signOut() {
    await call("/api/auth/logout", {});
    router.replace("/");
  }

  async function leave() {
    if (busy) return;
    setBusy(true);
    const result = await call("/api/campsite/leave", {});
    setBusy(false);
    if (result.ok) router.replace("/camp/setup");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-10 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="patch thin-scroll max-h-full w-full max-w-[26rem] overflow-y-auto rise p-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Camp settings"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="display text-base uppercase tracking-[0.12em] text-cream">Camp Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-cream/25 text-cream/70"
          >
            ✕
          </button>
        </div>

        <button
          onClick={() => {
            onClose();
            onOpenLogbook();
          }}
          className="mb-5 flex w-full items-center gap-3 rounded-xl border-2 border-cream/20 bg-black/25 px-3.5 py-3 text-left transition-colors active:bg-black/40"
        >
          <span aria-hidden className="text-xl">
            📖
          </span>
          <span className="min-w-0 flex-1">
            <span className="display block text-[0.82rem] uppercase tracking-[0.1em] text-cream">
              Today&apos;s Logbook
            </span>
            <span className="block truncate text-[0.74rem] text-cream/55">
              {state.messages.length === 0
                ? "No notes yet today"
                : `${state.messages.length} note${state.messages.length === 1 ? "" : "s"} from the camp`}
            </span>
          </span>
          <span aria-hidden className="text-cream/40">
            ›
          </span>
        </button>

        {camp && (
          <>
            <Section title="Camp code">
              <div className="parchment flex items-center gap-3 px-3 py-2.5">
                <span
                  className="flex-1 text-[1.6rem] leading-none tracking-[0.2em] text-ink"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {camp.code}
                </span>
                <CopyButton value={camp.code} />
              </div>
              <p className="mt-1.5 text-[0.72rem] text-cream/50">
                Anyone with this code can join {camp.name} and help keep the fire in.
              </p>
            </Section>

            <Section title={`Around the fire (${state.members.length})`}>
              <ul className="flex flex-col gap-1.5">
                {state.members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-2.5 rounded-lg bg-black/25 px-3 py-2"
                  >
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        background: m.solvedToday ? "#f2a93b" : "rgba(245,234,210,0.2)",
                        boxShadow: m.solvedToday ? "0 0 8px rgba(242,169,59,0.9)" : "none",
                      }}
                    />
                    <span className="flex-1 truncate text-sm text-cream/90">
                      {m.displayName}
                      {m.isYou && <span className="text-cream/40"> (you)</span>}
                    </span>
                    <span className="text-[0.68rem] uppercase tracking-wide text-cream/40">
                      {m.solvedToday ? "solved" : "waiting"}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          </>
        )}

        <Section title="Fire">
          <div className="rounded-lg bg-black/25 px-3 py-2.5 text-sm text-cream/75">
            <p>
              <span className="text-gold">{camp?.tierLabel ?? "—"}</span> ·{" "}
              {Math.round(camp?.intensity ?? 0)}/100
            </p>
            <p className="mt-0.5 text-[0.76rem] text-cream/50">{camp?.tierBlurb}</p>
            <p className="mt-1 text-[0.76rem] text-cream/50">
              Every solve adds 34. Left alone, a full fire burns out in 24 hours.
            </p>
          </div>
        </Section>

        <Section title="Time travel (for testing)">
          <p className="mb-2 text-[0.74rem] leading-relaxed text-cream/55">
            Pushes the whole camp forward so you can watch the fire decay and the
            puzzle reset without waiting. Affects every member.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {JUMPS.map((j) => (
              <button
                key={j.label}
                disabled={busy}
                onClick={() => travel({ advanceMs: j.ms })}
                className="btn btn-sm btn-quiet flex-1"
              >
                {j.label}
              </button>
            ))}
          </div>
          <button
            disabled={busy || state.timeOffsetMs === 0}
            onClick={() => travel({ reset: true })}
            className="btn btn-sm btn-quiet mt-1.5 w-full"
          >
            Back to real time
          </button>
          <p className="mt-1.5 text-center text-[0.72rem] text-cream/45">
            Currently{" "}
            {state.timeOffsetMs === 0
              ? "in real time"
              : `${formatDuration(state.timeOffsetMs)} ahead`}
            {" · next word in "}
            {formatDuration(state.msUntilNextWord)}
          </p>
        </Section>

        <div className="mt-5 flex gap-2">
          <button onClick={leave} disabled={busy} className="btn btn-sm btn-quiet flex-1">
            Leave Camp
          </button>
          <button onClick={signOut} className="btn btn-sm btn-quiet flex-1">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="mb-1.5 text-[0.68rem] uppercase tracking-[0.18em] text-cream/45">{title}</h3>
      {children}
    </section>
  );
}
