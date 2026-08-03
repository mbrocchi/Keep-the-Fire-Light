/**
 * Shaders for the campfire.
 *
 * Two passes over the same quad, both covering FIRE_RECT of the stage:
 *
 *   1. HEAT — samples the actual background image with UVs pushed around by
 *      rising noise, drawn with normal alpha blending and an alpha that fades
 *      to zero at the edge of the hot column. Because alpha and displacement
 *      fall off together, the pass leaves no seam against the CSS background
 *      behind it; the tent, trees and lantern genuinely shimmer.
 *
 *   2. FLAME — a noise-eroded teardrop shaded through a black-body ramp,
 *      drawn additively so it lights whatever it sits on.
 *
 * Sparks are a third additive draw of point sprites, positioned on the CPU.
 */

export const QUAD_VERT = /* glsl */ `#version 300 es
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main() {
  // aPos is a -1..1 quad; vUv is 0..1 with y measured UP from the ground.
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

/** Value noise + fbm + the shared flame silhouette, included by both passes. */
const NOISE = /* glsl */ `
float hash(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float total = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    total += valueNoise(p) * amp;
    p = p * 2.03 + vec2(17.3, 9.1);
    amp *= 0.5;
  }
  return total;
}

// Height above the pit, normalised so 0 is the log bed and 1 the flame tip.
float flameHeight(vec2 uv, vec2 pit, float height) {
  return (uv.y - pit.y) / max(height, 1e-4);
}

// Half-width of the flame column at normalised height h: pinched where it
// meets the logs, widest just above them, tapering to nothing at the tip.
float flameWidth(float h, float halfWidth) {
  float taper = pow(max(1.0 - h, 0.0), 0.62);
  float pinch = 0.42 + 0.58 * smoothstep(0.0, 0.14, h);
  return halfWidth * taper * pinch;
}
`;

export const HEAT_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uBg;
uniform vec2 uRectOrigin;   // FIRE_RECT.x / .y  (fraction of the stage)
uniform vec2 uRectSize;     // FIRE_RECT.w / .h
uniform vec2 uPit;          // pit centre in this quad's uv, y up
uniform float uHalfWidth;
uniform float uTime;
uniform float uIntensity;   // 0..1, already smoothed
uniform float uAspect;      // quad width / height, to keep noise isotropic

${NOISE}

void main() {
  float height = mix(0.09, 0.46, uIntensity); // must track the flame pass
  float h = flameHeight(vUv, uPit, height);

  // The shimmer is a plume just above the flames. Every term below has to
  // reach zero WELL INSIDE the quad: wherever alpha is still non-zero at the
  // edge, this pass repaints the artwork through a different sampler and the
  // quad itself becomes visible as a box over the tent.
  float rise = smoothstep(0.25, 0.80, h) * (1.0 - smoothstep(0.95, 1.55, h));

  // Capped, because |vUv.x - uPit.x| only ever reaches 0.5 — a spread at or
  // above that never falls off before the side edges.
  float spread = min(0.30, uHalfWidth * (1.25 + 0.75 * clamp(h, 0.0, 2.0)));
  float lateral = 1.0 - smoothstep(spread * 0.35, spread, abs(vUv.x - uPit.x));

  // Backstop against the quad's own boundary, whatever the terms above do.
  vec2 inset = smoothstep(vec2(0.0), vec2(0.14), vUv)
             * smoothstep(vec2(0.0), vec2(0.14), 1.0 - vUv);

  float heat = rise * lateral * inset.x * inset.y
             * smoothstep(0.05, 0.45, uIntensity);
  if (heat <= 0.002) discard;

  vec2 np = vec2(vUv.x * uAspect, vUv.y) * 9.0;
  float t = uTime * 0.85;
  float nx = fbm(np + vec2(0.0, -t)) - 0.5;
  float ny = fbm(np + vec2(5.3, -t * 1.27) + 31.7) - 0.5;

  // Displacement in stage space, so it doesn't stretch with the quad.
  vec2 amount = vec2(nx, ny) * heat * (0.010 + 0.016 * uIntensity);
  amount.x *= 1.4;

  // vUv has y up; the texture has y down.
  vec2 stageUv = uRectOrigin + vec2(vUv.x, 1.0 - vUv.y) * uRectSize;
  vec3 shifted = texture(uBg, stageUv + amount * uRectSize).rgb;

  // A whisper of heat colour, tied to how hard the pixel is actually being
  // pushed around rather than painted flat across the plume.
  float churn = abs(nx) + abs(ny);
  shifted += vec3(0.14, 0.06, 0.01) * heat * uIntensity * churn;

  // Never fully opaque: the layer underneath keeps the artwork honest.
  outColor = vec4(shifted, heat * 0.88);
}`;

export const FLAME_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform vec2 uPit;
uniform float uHalfWidth;
uniform float uTime;
uniform float uIntensity;
uniform float uFlicker;
uniform float uAspect;

${NOISE}

// Black-body-ish ramp: white-hot core through gold and orange to a dull red
// that dissolves into smoke.
vec3 fireRamp(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c = mix(vec3(0.34, 0.03, 0.01), vec3(0.88, 0.24, 0.05), smoothstep(0.00, 0.30, t));
  c = mix(c, vec3(1.00, 0.53, 0.11), smoothstep(0.28, 0.58, t));
  c = mix(c, vec3(1.00, 0.80, 0.34), smoothstep(0.55, 0.80, t));
  c = mix(c, vec3(1.00, 0.96, 0.82), smoothstep(0.78, 1.00, t));
  return c;
}

// One layer of flame. Offsetting the seed, speed and lateral position per
// layer is what reads as several tongues licking past each other rather than
// one solid column.
float tongue(vec2 uv, float height, float halfWidth, float xOffset, float seed, float speed) {
  float h = flameHeight(uv, uPit, height);
  if (h < -0.05 || h > 1.35) return 0.0;

  float t = uTime * speed;

  // Slow lateral sway, growing with height so the tip wanders most.
  float sway = (fbm(vec2(uv.y * 3.1 + seed, t * 0.35)) - 0.5)
             * halfWidth * 2.2 * smoothstep(0.0, 0.9, h);

  float w = flameWidth(h, halfWidth);
  float dx = (uv.x - uPit.x - xOffset - sway) / max(w, 1e-4);

  float body = 1.0 - abs(dx);
  if (body <= 0.0) return 0.0;

  // Rising turbulence eats into the silhouette, harder towards the tip, which
  // is what tears the top of the flame into separate licks.
  vec2 np = vec2(dx * 1.7 + seed * 3.0, uv.y * 9.0 * uAspect - t * 2.4);
  float turb = fbm(np);
  float erosion = turb * (0.34 + 1.15 * h) + h * 0.18;

  return smoothstep(0.0, 0.30, body - erosion);
}

void main() {
  float intensity = clamp(uIntensity, 0.0, 1.0);
  float flicker = uFlicker;

  // A campfire is roughly as tall as it is wide at the base, not a gas jet.
  float height = mix(0.09, 0.46, intensity) * flicker;
  float halfWidth = uHalfWidth * mix(0.78, 1.34, intensity) * mix(1.0, flicker, 0.4);

  float a = tongue(vUv, height,        halfWidth,        0.0,               0.0,  1.00);
  float b = tongue(vUv, height * 0.78, halfWidth * 0.62, -halfWidth * 0.44, 11.7, 1.36) * 0.90;
  float c = tongue(vUv, height * 1.10, halfWidth * 0.44,  halfWidth * 0.40, 27.3, 0.84) * 0.70;

  // Below a certain heat there are no flames left at all, only glowing coals —
  // otherwise a dead fire still shows a stubborn little candle.
  float flame = clamp(a + b + c, 0.0, 1.6) * smoothstep(0.02, 0.22, intensity);

  // Temperature: hottest deep in the overlapping layers near the logs.
  float h = flameHeight(vUv, uPit, height);
  float core = flame * (1.0 - smoothstep(0.0, 0.72, h));
  float temp = clamp(flame * 0.52 + core * 0.85, 0.0, 1.0);

  vec3 col = fireRamp(temp) * flame;

  // The bed of embers among the logs — always present, even when the flames
  // have died down to nothing.
  // Nothing at all is drawn over a dead pit — no coals, no halo. The artwork
  // already paints an unlit fire pit, and that is exactly what a cold camp
  // should look like.
  float alive = smoothstep(0.0, 0.05, intensity);

  float bedDist = length(vec2((vUv.x - uPit.x) / (uHalfWidth * 1.45),
                              (vUv.y - uPit.y) / (uHalfWidth * 0.46 / uAspect)));
  float bedPulse = 0.72 + 0.28 * fbm(vec2(vUv.x * 14.0, vUv.y * 14.0 - uTime * 0.5));
  float bed = (1.0 - smoothstep(0.35, 1.0, bedDist)) * bedPulse * alive;
  col += mix(vec3(0.70, 0.15, 0.02), vec3(1.0, 0.62, 0.18), intensity)
       * bed * (0.34 + 0.95 * intensity);

  // Close-in glow so the flame sits in light rather than on top of the paint.
  // It spreads as the fire grows, rather than just getting brighter. An
  // exponential never truly reaches zero, so it is forced to nothing at the
  // quad's boundary — otherwise its faint tail traces the quad as a rectangle.
  vec2 inset = smoothstep(vec2(0.0), vec2(0.10), vUv)
             * smoothstep(vec2(0.0), vec2(0.10), 1.0 - vUv);
  float halo = exp(-length(vec2((vUv.x - uPit.x) * uAspect,
                                (vUv.y - uPit.y) * 0.85)) * mix(6.4, 4.4, intensity))
             * alive * inset.x * inset.y;
  col += vec3(1.0, 0.46, 0.12) * halo * (0.10 + 0.55 * intensity) * flicker;

  float alpha = clamp(max(flame, max(bed, halo * 0.5)), 0.0, 1.0);
  if (alpha <= 0.002) discard;
  outColor = vec4(col, alpha);
}`;

export const SPARK_VERT = /* glsl */ `#version 300 es
layout(location = 0) in vec2 aPos;   // clip space -1..1
layout(location = 1) in float aSize; // px
layout(location = 2) in float aHeat; // 1 = just born, 0 = spent
out float vHeat;
uniform float uDpr;
void main() {
  vHeat = aHeat;
  gl_PointSize = aSize * uDpr;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

export const SPARK_FRAG = /* glsl */ `#version 300 es
precision mediump float;
in float vHeat;
out vec4 outColor;
void main() {
  // Soft round sprite with a brighter centre.
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float falloff = 1.0 - smoothstep(0.0, 1.0, d);
  falloff *= falloff;
  float hot = clamp(vHeat, 0.0, 1.0);
  vec3 col = mix(vec3(0.85, 0.16, 0.02), vec3(1.0, 0.92, 0.66), hot * hot);
  outColor = vec4(col * falloff, falloff * (0.25 + 0.75 * hot));
}`;
