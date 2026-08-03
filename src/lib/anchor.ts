/**
 * Where things sit on the painted artwork.
 *
 * Every number here is a fraction of the background image (768 x 1376), never
 * of the viewport. The Stage renders that image at a fixed aspect ratio and
 * never crops it, so these fractions resolve to the same spot on the painting
 * on a 375px phone and a 27" monitor alike. Tune the fire here and nowhere else.
 */
export const STAGE_WIDTH = 768;
export const STAGE_HEIGHT = 1376;
export const STAGE_ASPECT = STAGE_WIDTH / STAGE_HEIGHT;

/** Centre of the painted stone ring, and the width of the log bed inside it. */
export const PIT = {
  x: 0.502,
  y: 0.828,
  width: 0.23,
};

/** The rectangle the fire canvas occupies — the pit plus headroom for flames. */
export const FIRE_RECT = {
  x: 0.16,
  y: 0.42,
  w: 0.68,
  h: 0.52,
};

/** Pit position expressed in the fire canvas's own 0..1 space (y measured up). */
export const PIT_IN_CANVAS = {
  x: (PIT.x - FIRE_RECT.x) / FIRE_RECT.w,
  y: 1 - (PIT.y - FIRE_RECT.y) / FIRE_RECT.h,
  halfWidth: PIT.width / 2 / FIRE_RECT.w,
};

/** The band of sky that shooting stars cross. */
export const SKY_RECT = {
  x: 0.02,
  y: 0.02,
  w: 0.96,
  h: 0.42,
};

export const rectStyle = (r: { x: number; y: number; w: number; h: number }) => ({
  left: `${r.x * 100}%`,
  top: `${r.y * 100}%`,
  width: `${r.w * 100}%`,
  height: `${r.h * 100}%`,
});
