"use client";

import { useState } from "react";

interface Props {
  value: string;
  className?: string;
  label?: string;
}

export default function CopyButton({ value, className = "", label = "Copy Code" }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard access needs a secure context, which plain-HTTP LAN isn't on
      // every browser. Fall back to the old selection trick so the button still
      // works on a phone.
      const field = document.createElement("textarea");
      field.value = value;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      try {
        document.execCommand("copy");
      } catch {
        /* nothing more we can do; the code is on screen to read */
      }
      document.body.removeChild(field);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button type="button" onClick={copy} className={`btn btn-sm btn-quiet ${className}`}>
      {copied ? "✓ Copied" : label}
    </button>
  );
}
