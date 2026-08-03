"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiResult, CampState } from "./shared";

/** Throw-free API call: never rejects, always returns a discriminated result. */
export async function call(path: string, body?: unknown): Promise<ApiResult> {
  try {
    const res = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    return (await res.json()) as ApiResult;
  } catch {
    return { ok: false, error: "Lost the connection to camp" };
  }
}

const POLL_MS = 12_000;

interface Options {
  /** Keep polling so members see each other's fire and notes appear. */
  poll?: boolean;
}

/**
 * Owns the client's copy of camp state.
 *
 * Every mutating endpoint returns fresh state, so actions never need a
 * follow-up fetch — the reply *is* the refresh.
 */
export function useCamp({ poll = false }: Options = {}) {
  const [state, setState] = useState<CampState | null>(null);
  const [loading, setLoading] = useState(true);
  /** Bumped whenever the fire is stoked, to trigger the ember burst. */
  const [flareToken, setFlareToken] = useState(0);
  const lastIntensity = useRef<number | null>(null);

  const apply = useCallback((result: ApiResult) => {
    if (!result.ok) return result;
    const next = result.state;
    const previous = lastIntensity.current;
    const current = next?.campsite?.intensity ?? null;
    // A jump in intensity means somebody — you or a relative — just solved.
    if (previous !== null && current !== null && current > previous + 1) {
      setFlareToken((n) => n + 1);
    }
    lastIntensity.current = current;
    setState(next);
    return result;
  }, []);

  const refresh = useCallback(async () => {
    const result = await call("/api/session");
    apply(result);
    setLoading(false);
    return result;
  }, [apply]);

  const send = useCallback(
    async (path: string, body: unknown = {}) => apply(await call(path, body)),
    [apply]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!poll) return;
    const tick = () => {
      if (!document.hidden) void refresh();
    };
    const id = window.setInterval(tick, POLL_MS);
    // Coming back to the app should feel instant, not up to 12s stale.
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [poll, refresh]);

  return { state, setState, loading, refresh, send, apply, flareToken, setFlareToken };
}

/** Formats a duration as `6h 12m`, or `12m` under an hour. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}
