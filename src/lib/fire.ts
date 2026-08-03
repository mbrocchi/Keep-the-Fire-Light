import { DAY_MS } from "./time";
import type { FireState } from "./types";

/** A fire left completely alone burns out in exactly 24 hours. */
export const DECAY_PER_DAY = 100;
/** One solve. Three members in a day gets you to a roaring fire. */
export const STOKE_AMOUNT = 34;

export const MAX_INTENSITY = 100;

const DECAY_PER_MS = DECAY_PER_DAY / DAY_MS;

export function clampIntensity(v: number): number {
  return Math.min(MAX_INTENSITY, Math.max(0, v));
}

/** Fire intensity right now, derived lazily from the last known value. */
export function currentIntensity(fire: FireState, at: number): number {
  const elapsed = Math.max(0, at - fire.updatedAt);
  return clampIntensity(fire.intensity - elapsed * DECAY_PER_MS);
}

/** Collapses the decay into stored state and adds `amount`. */
export function stoke(fire: FireState, at: number, amount = STOKE_AMOUNT): FireState {
  return { intensity: clampIntensity(currentIntensity(fire, at) + amount), updatedAt: at };
}

export function freshFire(at: number): FireState {
  // A new camp is a cold pit. Somebody has to solve the word to light it —
  // that first stoke is the point of the whole thing.
  return { intensity: 0, updatedAt: at };
}

export interface Tier {
  key: string;
  label: string;
  blurb: string;
  min: number;
}

/** Ordered high to low so `tierOf` can take the first match. */
export const TIERS: Tier[] = [
  { key: "roaring", label: "Roaring", blurb: "The whole camp is lit up.", min: 85 },
  { key: "strong", label: "Strong", blurb: "Burning bright and steady.", min: 60 },
  { key: "steady", label: "Steady", blurb: "Warm enough to sit close.", min: 35 },
  { key: "smouldering", label: "Smouldering", blurb: "Holding on. Someone should play.", min: 15 },
  { key: "embers", label: "Embers", blurb: "Nearly out. It needs you.", min: 0.5 },
  { key: "cold", label: "Cold ashes", blurb: "The fire has gone out.", min: -1 },
];

export function tierOf(intensity: number): Tier {
  return TIERS.find((t) => intensity > t.min) ?? TIERS[TIERS.length - 1];
}

/** Hours of burn time left at the current intensity, for the HUD. */
export function hoursRemaining(intensity: number): number {
  return (intensity / DECAY_PER_DAY) * 24;
}
