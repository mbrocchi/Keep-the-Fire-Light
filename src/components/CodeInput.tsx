"use client";

import { useRef } from "react";

interface Props {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
}

const LENGTH = 6;

/**
 * Six character boxes for a camp code. A single hidden-ish input backs all six
 * so paste, autofill and the mobile keyboard all behave normally — per-box
 * inputs look tidy but fight the phone at every step.
 */
export default function CodeInput({ value, onChange, onComplete }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const chars = value.padEnd(LENGTH, " ").slice(0, LENGTH).split("");
  const cursor = Math.min(value.length, LENGTH - 1);

  return (
    <div
      className="relative"
      onClick={() => inputRef.current?.focus()}
      onKeyDown={(e) => {
        if (e.key === "Enter") inputRef.current?.blur();
      }}
    >
      <input
        ref={inputRef}
        value={value}
        inputMode="text"
        autoCapitalize="characters"
        autoCorrect="off"
        autoComplete="one-time-code"
        spellCheck={false}
        maxLength={LENGTH}
        aria-label="Camp code"
        onChange={(e) => {
          const next = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, LENGTH);
          onChange(next);
          if (next.length === LENGTH) onComplete?.(next);
        }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
      <div className="pointer-events-none flex justify-between gap-1.5">
        {chars.map((char, i) => (
          <div
            key={i}
            className={`flex aspect-[3/4] flex-1 items-center justify-center rounded-lg border-2 text-2xl font-black transition-all ${
              i === cursor && value.length < LENGTH
                ? "border-gold bg-night/80 shadow-[0_0_0_3px_rgba(242,169,59,0.2)]"
                : char.trim()
                  ? "border-cream/40 bg-night/70"
                  : "border-cream/20 bg-night/50"
            }`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            <span className={char.trim() ? "text-cream" : "text-cream/20"}>
              {char.trim() || "·"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
