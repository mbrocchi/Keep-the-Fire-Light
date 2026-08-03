import type { CSSProperties, ReactNode } from "react";
import { STAGE_HEIGHT, STAGE_WIDTH } from "@/lib/anchor";

interface Props {
  /** Path under /art. */
  image: string;
  children?: ReactNode;
  className?: string;
  /**
   * Height to keep free at the bottom of the screen, e.g. `"4.25rem"` for the
   * camp screen's action bar. The picture shrinks to fit above it rather than
   * being overlapped, so a short viewport can never push a control onto the
   * fire pit.
   */
  reserveBottom?: string;
}

/**
 * The framed poster.
 *
 * Holds the artwork at its own 768x1376 aspect ratio and never crops it, so a
 * position given as a percentage lands on the same brushstroke on every device.
 * Whatever height is left over becomes a matte in the same cream as the paper
 * border painted into the images, which reads as part of the frame.
 */
export default function Stage({ image, children, className = "", reserveBottom }: Props) {
  const frameStyle = { "--stage-reserve": reserveBottom ?? "0px" } as CSSProperties;

  const style: CSSProperties = {
    width: `min(100vw, calc((100dvh - var(--stage-reserve, 0px)) * ${STAGE_WIDTH} / ${STAGE_HEIGHT}))`,
    aspectRatio: `${STAGE_WIDTH} / ${STAGE_HEIGHT}`,
  };

  return (
    <div className="ktfl-frame" style={frameStyle}>
      <div className={`ktfl-stage ${className}`} style={style}>
        <div
          aria-hidden
          className="absolute inset-0 z-0 bg-cover"
          style={{ backgroundImage: `url(/art/${image})`, backgroundSize: "100% 100%" }}
        />
        {children}
      </div>
    </div>
  );
}
