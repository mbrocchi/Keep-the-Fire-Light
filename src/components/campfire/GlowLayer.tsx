import { PIT } from "@/lib/anchor";

/**
 * The light the fire throws on the painting.
 *
 * Pure CSS driven by the `--fire-glow` / `--fire-flicker` / `--fire-intensity`
 * custom properties the campfire publishes every frame, so it costs nothing and
 * stays in perfect step with the flames.
 *
 * Kept deliberately local. A wide wash reads as a filter over the artwork
 * rather than as firelight, and flattens the illustration. Everything here
 * falls off within roughly a fire's width of the pit, and every radius is
 * multiplied by the flicker so the pool of light breathes rather than sitting
 * still. No CSS transitions — they would smooth the flicker back out into mush.
 *
 * Sizes must use the `ellipse <x> <y>` form: a `circle` radius cannot be a
 * percentage, and such a gradient is dropped silently.
 */
export default function GlowLayer() {
  const at = `${PIT.x * 100}% ${PIT.y * 100}%`;

  // Radii grow with the fire, then wobble with the flicker.
  const core = {
    x: "calc((7% + var(--fire-intensity, 0) * 7%) * var(--fire-flicker, 1))",
    y: "calc((4.5% + var(--fire-intensity, 0) * 4.5%) * var(--fire-flicker, 1))",
  };
  const spill = {
    x: "calc((15% + var(--fire-intensity, 0) * 13%) * var(--fire-flicker, 1))",
    y: "calc((9% + var(--fire-intensity, 0) * 8%) * var(--fire-flicker, 1))",
  };

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {/* Hot centre: brightens the stones and the logs immediately around it. */}
      <div
        className="absolute inset-0"
        style={{
          mixBlendMode: "screen",
          opacity: "calc(var(--fire-glow, 0) * 0.62)",
          background: `radial-gradient(ellipse ${core.x} ${core.y} at ${at},
            rgba(255, 206, 128, 0.85) 0%,
            rgba(241, 146, 56, 0.40) 46%,
            rgba(176, 68, 18, 0) 100%)`,
        }}
      />

      {/* A little further out: warms the ground and the nearest log. */}
      <div
        className="absolute inset-0"
        style={{
          mixBlendMode: "soft-light",
          opacity: "calc(var(--fire-glow, 0) * 0.40)",
          background: `radial-gradient(ellipse ${spill.x} ${spill.y} at ${at},
            rgba(255, 184, 96, 0.90) 0%,
            rgba(220, 116, 44, 0.34) 52%,
            rgba(90, 40, 12, 0) 100%)`,
        }}
      />

      {/* Night closing in as the fire dies. Gentle — this is mood, not a filter. */}
      <div
        className="absolute inset-0"
        style={{
          mixBlendMode: "multiply",
          opacity: "calc(0.34 - var(--fire-glow, 0) * 0.30)",
          background: `radial-gradient(ellipse 88% 62% at ${at},
            rgba(255, 255, 255, 1) 0%,
            rgba(150, 158, 186, 1) 55%,
            rgba(86, 96, 132, 1) 100%)`,
        }}
      />
    </div>
  );
}
