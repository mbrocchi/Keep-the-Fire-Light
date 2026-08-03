"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Stage from "@/components/Stage";
import { useCamp } from "@/lib/useCamp";

/**
 * Title screen.
 *
 * The buttons sit in the wide empty band of grass the artwork leaves below the
 * painted campfire, so nothing important is covered up.
 */
export default function TitlePage() {
  const { state, loading } = useCamp();
  const router = useRouter();

  // Warm the camp route so tapping through feels instant on a phone.
  useEffect(() => {
    router.prefetch("/camp");
    router.prefetch("/auth");
  }, [router]);

  const signedIn = Boolean(state);
  const inCamp = Boolean(state?.campsite);

  return (
    <Stage image="title.png">
      {/* Lift the buttons off the embroidery just enough to read. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[46%]"
        style={{
          background:
            "linear-gradient(to top, rgba(8,26,22,0.72) 0%, rgba(8,26,22,0.42) 45%, transparent 100%)",
        }}
      />

      <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-3 px-[9%] pb-[8%]">
        {loading ? (
          <p className="display text-sm tracking-[0.3em] text-cream/70 uppercase">Lighting…</p>
        ) : signedIn ? (
          <>
            <Link
              href={inCamp ? "/camp" : "/camp/setup"}
              className="btn btn-ember w-full max-w-[22rem] rise text-lg"
            >
              {inCamp ? "Return to Camp" : "Set Up Your Camp"}
            </Link>
            <p className="text-center text-sm text-cream/75">
              Welcome back, <span className="text-gold">{state?.user.displayName}</span>
              {state?.campsite ? ` — ${state.campsite.name}` : ""}
            </p>
          </>
        ) : (
          <>
            <Link href="/auth?mode=register" className="btn btn-ember w-full max-w-[22rem] rise text-lg">
              Light Your First Fire
            </Link>
            <Link
              href="/auth?mode=login"
              className="btn btn-cream w-full max-w-[22rem] rise text-base"
              style={{ animationDelay: "80ms" }}
            >
              I&apos;ve Been Here Before
            </Link>
            <p className="mt-1 max-w-[24rem] text-center text-[0.8rem] leading-relaxed text-cream/70">
              One word a day. Everyone who solves it keeps the fire burning for
              the rest of the camp.
            </p>
          </>
        )}
      </div>
    </Stage>
  );
}
