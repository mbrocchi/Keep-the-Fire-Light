"use client";

import type { Mark } from "@/lib/types";

interface Props {
  state: Record<string, Mark>;
  onKey: (key: string) => void;
  disabled: boolean;
}

const ROWS = ["QWERTYUIOP", "ASDFGHJKL", "↵ZXCVBNM⌫"];

const TONE: Record<Mark, string> = {
  correct: "linear-gradient(168deg,#65984a,#41682e)",
  present: "linear-gradient(168deg,#e0a83c,#b47c1c)",
  absent: "linear-gradient(168deg,#2b353b,#1c2429)",
};

export default function Keyboard({ state, onKey, disabled }: Props) {
  return (
    <div className="flex select-none flex-col gap-1.5">
      {ROWS.map((row, i) => (
        <div key={i} className="flex justify-center gap-1">
          {row.split("").map((key) => {
            const wide = key === "↵" || key === "⌫";
            const mark = state[key];
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                aria-label={key === "↵" ? "Enter" : key === "⌫" ? "Backspace" : key}
                onPointerDown={(e) => {
                  // Pointer-down keeps typing responsive on a phone; preventing
                  // default stops the key stealing focus from the sheet.
                  e.preventDefault();
                  if (!disabled) onKey(key);
                }}
                className="flex h-[clamp(2.6rem,7.2vh,3.4rem)] items-center justify-center rounded-md border border-black/25 text-cream shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_2px_0_rgba(0,0,0,0.3)] transition-transform active:translate-y-[2px] disabled:opacity-50"
                style={{
                  flex: wide ? "1.6 1 0" : "1 1 0",
                  minWidth: 0,
                  fontFamily: "var(--font-display)",
                  fontSize: wide ? "0.95rem" : "clamp(0.8rem,3.4vw,1.05rem)",
                  background: mark ? TONE[mark] : "linear-gradient(168deg,#4a6570,#334750)",
                }}
              >
                {key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
