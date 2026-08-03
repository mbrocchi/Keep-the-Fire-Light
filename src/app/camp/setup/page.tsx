"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ScreenShell from "@/components/ScreenShell";
import CodeInput from "@/components/CodeInput";
import CopyButton from "@/components/CopyButton";
import { call, useCamp } from "@/lib/useCamp";

type Tab = "create" | "join";

export default function CampSetupPage() {
  const router = useRouter();
  const { state, loading, refresh } = useCamp();
  const [tab, setTab] = useState<Tab>("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !state) router.replace("/auth");
  }, [loading, state, router]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await call("/api/campsite/create", { name });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setCreated(result.code ?? null);
    await refresh();
  }

  async function join(submitted?: string) {
    const value = (submitted ?? code).trim();
    if (busy || value.length !== 6) return;
    setBusy(true);
    setError(null);
    const result = await call("/api/campsite/join", { code: value });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    router.replace("/camp");
  }

  if (created) {
    return (
      <ScreenShell
        title="Your Camp Is Lit"
        subtitle="Share this code with the people you want around the fire."
      >
        <div className="mx-auto w-full max-w-[24rem] rise">
          <div className="parchment px-5 py-6 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-ink/55">Camp code</p>
            <p
              className="my-3 text-[2.6rem] leading-none tracking-[0.16em] text-ink"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {created}
            </p>
            <CopyButton value={created} />
          </div>
          <button onClick={() => router.replace("/camp")} className="btn btn-ember mt-5 w-full">
            Enter Camp
          </button>
        </div>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      back="/"
      title="Find Your People"
      subtitle="A campsite is one shared fire. Start one, or join the one your family already has."
    >
      <div className="mx-auto w-full max-w-[24rem]">
        <div className="patch mb-4 flex gap-1 rounded-full p-1">
          {(["create", "join"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                setError(null);
              }}
              className={`display flex-1 rounded-full py-2.5 text-xs uppercase tracking-[0.12em] transition-all ${
                tab === t
                  ? "bg-ember text-cream shadow-[inset_0_-2px_0_rgba(0,0,0,0.25)]"
                  : "text-cream/60 hover:text-cream"
              }`}
            >
              {t === "create" ? "Start a camp" : "Join a camp"}
            </button>
          ))}
        </div>

        {tab === "create" ? (
          <form onSubmit={create} className="rise">
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-[0.14em] text-cream/60">
                Name your campsite
              </span>
              <input
                className="field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={28}
                placeholder="The Whitmore Fire"
                required
              />
            </label>
            <button type="submit" disabled={busy} className="btn btn-ember mt-4 w-full">
              {busy ? "Gathering wood…" : "Build the Fire Pit"}
            </button>
          </form>
        ) : (
          <div className="rise">
            <span className="mb-2 block text-xs uppercase tracking-[0.14em] text-cream/60">
              Enter the 6-character code
            </span>
            <CodeInput value={code} onChange={setCode} onComplete={join} />
            <button
              onClick={() => join()}
              disabled={busy || code.length !== 6}
              className="btn btn-ember mt-4 w-full"
            >
              {busy ? "Walking over…" : "Join This Camp"}
            </button>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-ember/20 px-3 py-2 text-sm text-gold shake">
            {error}
          </p>
        )}
      </div>
    </ScreenShell>
  );
}
