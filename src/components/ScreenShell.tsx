import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import Stage from "./Stage";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Shows a back chevron to this route. */
  back?: string;
}

/**
 * The frame for everything that isn't the camp itself: the campsite artwork,
 * dimmed right down so form fields stay legible, with the patch logo on top.
 */
export default function ScreenShell({ title, subtitle, children, back }: Props) {
  return (
    <Stage image="background.png">
      <div aria-hidden className="absolute inset-0 z-10 bg-night/78 backdrop-blur-[3px]" />

      <div className="ktfl-overlay thin-scroll overflow-y-auto">
        <div className="flex min-h-full flex-col px-[7%] pb-10 pt-[max(1.25rem,env(safe-area-inset-top))]">
          {back && (
            <Link
              href={back}
              className="mb-2 self-start text-sm text-cream/70 transition-colors hover:text-gold"
            >
              ← Back
            </Link>
          )}

          <div className="flex flex-col items-center text-center">
            <Image
              src="/art/logo.png"
              alt="Keep The Fire Light"
              width={800}
              height={793}
              priority
              className="h-auto w-[46%] max-w-[190px] drop-shadow-[0_6px_18px_rgba(0,0,0,0.55)]"
            />
            <h1 className="display embroidered mt-3 text-2xl uppercase">{title}</h1>
            {subtitle && (
              <p className="mt-1.5 max-w-[26rem] text-sm leading-relaxed text-cream/70">
                {subtitle}
              </p>
            )}
          </div>

          <div className="mt-5 flex-1">{children}</div>
        </div>
      </div>
    </Stage>
  );
}
