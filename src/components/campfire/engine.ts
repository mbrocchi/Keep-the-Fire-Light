/**
 * Renderer-agnostic fire simulation state: the intensity spring, the flicker
 * signal, and the ember particles. Both the WebGL and the 2D-canvas renderers
 * drive the same engine, so they behave identically and only look different.
 */

export interface Spark {
  /** Canvas-normalised, x right, y UP from the bottom. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  seed: number;
}

const STIFFNESS = 9;
// Just under critical damping, so a stoke swells past its mark and settles
// back. That overshoot is most of what makes the fire feel alive.
const DAMPING = 1.7 * Math.sqrt(STIFFNESS);

export class FireEngine {
  /** Smoothed 0..1 intensity — what the renderers actually draw. */
  intensity = 0;
  /** 0..1 target, set from server state. */
  target = 0;
  /** ~0.85..1.15 multiplier for flame size and glow. */
  flicker = 1;

  sparks: Spark[] = [];
  time = 0;

  private velocity = 0;
  private spawnDebt = 0;
  private reducedMotion = false;

  constructor(initial = 0, reducedMotion = false) {
    this.intensity = initial;
    this.target = initial;
    this.reducedMotion = reducedMotion;
  }

  setTarget(value01: number) {
    this.target = Math.max(0, Math.min(1, value01));
  }

  /** Jump without animating — used on first paint so the fire doesn't grow in. */
  snap(value01: number) {
    this.target = this.intensity = Math.max(0, Math.min(1, value01));
    this.velocity = 0;
  }

  /** A shower of embers, for the moment somebody solves the puzzle. */
  burst(count = 70) {
    for (let i = 0; i < count; i++) this.spawnSpark(true);
    this.velocity += 1.6;
  }

  private spawnSpark(energetic = false) {
    if (this.sparks.length > 420) return;
    const heat = 0.35 + this.intensity * 0.65;
    const spread = energetic ? 1.7 : 1;
    this.sparks.push({
      x: 0.5 + (Math.random() - 0.5) * 0.055 * spread,
      y: 0.02 + Math.random() * 0.02,
      vx: (Math.random() - 0.5) * 0.05 * spread,
      vy: (0.055 + Math.random() * 0.085) * heat * (energetic ? 1.5 : 1),
      age: 0,
      life: (1.1 + Math.random() * 2.4) * (0.6 + heat * 0.7),
      size: 1.1 + Math.random() * 2.6 * heat,
      seed: Math.random() * 1000,
    });
  }

  step(dt: number) {
    const d = Math.min(dt, 1 / 20); // never let a stalled tab teleport the sim
    this.time += d;

    // Intensity spring.
    const accel = (this.target - this.intensity) * STIFFNESS - this.velocity * DAMPING;
    this.velocity += accel * d;
    this.intensity = Math.max(0, Math.min(1, this.intensity + this.velocity * d));

    // Flicker: three detuned sines so it never repeats audibly, plus a little
    // noise. Amplitude grows with intensity — embers barely move, a roaring
    // fire pulses hard.
    const t = this.time;
    const wobble =
      Math.sin(t * 7.3) * 0.5 +
      Math.sin(t * 11.9 + 1.7) * 0.3 +
      Math.sin(t * 19.1 + 4.2) * 0.2;
    const amplitude = this.reducedMotion ? 0.03 : 0.06 + 0.11 * this.intensity;
    this.flicker = 1 + wobble * amplitude;

    this.stepSparks(d);
  }

  private stepSparks(d: number) {
    // Spawn rate ramps steeply: a dying fire throws the occasional lazy ember,
    // a roaring one throws a column of them.
    const rate = this.reducedMotion ? 2 : 3 + 105 * Math.pow(this.intensity, 1.35);
    this.spawnDebt += rate * d;
    while (this.spawnDebt >= 1) {
      this.spawnDebt -= 1;
      this.spawnSpark();
    }

    const kept: Spark[] = [];
    for (const s of this.sparks) {
      s.age += d;
      if (s.age >= s.life) continue;

      const life01 = s.age / s.life;
      // Buoyancy fades as the ember cools; drag brings it to a hover.
      s.vy += (0.035 * (1 - life01) - s.vy * 0.85) * d;
      // Lateral wander — the draught round a campfire is never still.
      s.vx += (Math.sin(this.time * 1.9 + s.seed) * 0.055 - s.vx * 1.1) * d;
      s.x += s.vx * d;
      s.y += s.vy * d;
      kept.push(s);
    }
    this.sparks = kept;
  }
}

/** Heat of a spark, 1 when newborn and 0 when spent. */
export function sparkHeat(s: Spark): number {
  const life01 = s.age / s.life;
  return Math.max(0, 1 - life01 * life01);
}
