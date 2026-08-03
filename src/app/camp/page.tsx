"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Stage from "@/components/Stage";
import Campfire from "@/components/campfire/Campfire";
import GlowLayer from "@/components/campfire/GlowLayer";
import ShootingStars from "@/components/campfire/ShootingStars";
import Hud from "@/components/camp/Hud";
import LogbookScreen from "@/components/camp/LogbookScreen";
import SettingsModal from "@/components/camp/SettingsModal";
import PuzzleSheet from "@/components/wordle/PuzzleSheet";
import { formatDuration, useCamp } from "@/lib/useCamp";
import { MAX_GUESSES } from "@/lib/wordle";

export default function CampPage() {
  const router = useRouter();
  const { state, loading, apply, flareToken } = useCamp({ poll: true });
  const [puzzleOpen, setPuzzleOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logbookOpen, setLogbookOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!state) router.replace("/auth");
    else if (!state.campsite) router.replace("/camp/setup");
  }, [loading, state, router]);

  // Clear the published fire variables on the way out, so a screen without a
  // campfire isn't left glowing.
  useEffect(
    () => () => {
      const root = document.documentElement.style;
      root.setProperty("--fire-glow", "0");
      root.setProperty("--fire-flicker", "1");
      root.setProperty("--fire-intensity", "0");
    },
    []
  );

  // Ambience + music, only once the fire is actually on screen. Signing out
  // (or leaving the campsite) unmounts this page, which runs the cleanup below
  // and stops both tracks — that's the whole "stop on logout" behaviour.
  const audioRef = useRef<{ ambient: HTMLAudioElement; music: HTMLAudioElement } | null>(null);
  const hasCampsite = Boolean(state?.campsite);
  useEffect(() => {
    if (!hasCampsite) return;

    const ambient = new Audio("/music/Outdoors.mp3");
    const music = new Audio("/music/music.mp3");
    ambient.loop = true;
    music.loop = true;
    music.volume = 0.03;
    audioRef.current = { ambient, music };

    // Browsers can block autoplay if this doesn't trace back to a user
    // gesture (e.g. a hard refresh landing straight on /camp). Swallow the
    // rejection rather than let it hit the console — the tracks just start
    // on the next tap in that case.
    ambient.play().catch(() => {});
    music.play().catch(() => {});

    return () => {
      ambient.pause();
      music.pause();
      audioRef.current = null;
    };
  }, [hasCampsite]);

  if (!state?.campsite) {
    return (
      <Stage image="background.png" reserveBottom="calc(4.25rem + env(safe-area-inset-bottom))">
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-night/70">
          <p className="display text-sm uppercase tracking-[0.3em] text-cream/70">Walking in…</p>
        </div>
      </Stage>
    );
  }

  const game = state.game;
  const solved = game.status === "won";
  const finished = game.status !== "playing";
  const started = game.guesses.length > 0;

  // A brand new camp has never been lit, which wants different words from a
  // fire that somebody let go out.
  const neverLit = state.campsite.intensity < 0.5 && state.campsite.daysLit === 0;
  const status = solved
    ? `You've fed the fire today. Next word in ${formatDuration(state.msUntilNextWord)}.`
    : finished
      ? `Out of guesses. New word in ${formatDuration(state.msUntilNextWord)}.`
      : neverLit
        ? "Cold stones. Solve today's word to light this fire."
        : state.campsite.tierBlurb;

  return (
    <>
      <Stage image="background.png" reserveBottom="calc(4.25rem + env(safe-area-inset-bottom))">
        <ShootingStars />
        <Campfire intensity={state.campsite.intensity} flareToken={flareToken} />
        <GlowLayer />

        {/* Only the HUD sits on the artwork now, up in the empty sky. Everything
            below the treeline is left to the fire. */}
        <div className="ktfl-overlay pointer-events-none">
          <Hud state={state} status={status} onSettings={() => setSettingsOpen(true)} />
        </div>
      </Stage>

      {/* Pinned to the bottom of the screen rather than the bottom of the
          picture, so on a tall phone it sits on the matte below the frame and
          never crowds the fire pit. */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, var(--color-matte) 42%, color-mix(in srgb, var(--color-matte) 55%, transparent) 72%, transparent 100%)",
          }}
        />
        <button
          onClick={() => setPuzzleOpen(true)}
          className={`btn relative w-full max-w-[20rem] ${finished ? "btn-quiet" : "btn-ember"}`}
        >
          {solved
            ? "✓ Solved — See Your Board"
            : finished
              ? "See Today's Word"
              : started
                ? `Keep Guessing (${MAX_GUESSES - game.guesses.length} left)`
                : "Solve Today's Puzzle"}
        </button>
      </div>

      {puzzleOpen && (
        <PuzzleSheet state={state} onState={apply} onClose={() => setPuzzleOpen(false)} />
      )}
      {logbookOpen && <LogbookScreen state={state} onClose={() => setLogbookOpen(false)} />}
      {settingsOpen && (
        <SettingsModal
          state={state}
          onState={apply}
          onClose={() => setSettingsOpen(false)}
          onOpenLogbook={() => setLogbookOpen(true)}
        />
      )}
    </>
  );
}
