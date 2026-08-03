"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ScreenShell from "@/components/ScreenShell";
import { call } from "@/lib/useCamp";

type Mode = "login" | "register";

function AuthForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(params.get("mode") === "login" ? "login" : "register");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    const result = await call(
      isRegister ? "/api/auth/register" : "/api/auth/login",
      isRegister ? { username, displayName, password } : { username, password }
    );

    if (!result.ok) {
      setError(result.error);
      setBusy(false);
      return;
    }

    router.replace(result.state?.campsite ? "/camp" : "/camp/setup");
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-[24rem]">
      <div className="patch mb-4 flex gap-1 rounded-full p-1">
        {(["register", "login"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`display flex-1 rounded-full py-2.5 text-xs uppercase tracking-[0.12em] transition-all ${
              mode === m
                ? "bg-ember text-cream shadow-[inset_0_-2px_0_rgba(0,0,0,0.25)]"
                : "text-cream/60 hover:text-cream"
            }`}
          >
            {m === "register" ? "New here" : "Sign in"}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-[0.14em] text-cream/60">
            Username
          </span>
          <input
            className="field"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            placeholder="grandma_jo"
            required
          />
        </label>

        {isRegister && (
          <label className="block rise">
            <span className="mb-1.5 block text-xs uppercase tracking-[0.14em] text-cream/60">
              What the camp calls you
            </span>
            <input
              className="field"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={24}
              placeholder="Grandma Jo"
              required
            />
          </label>
        )}

        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-[0.14em] text-cream/60">
            Password
          </span>
          <input
            className="field"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isRegister ? "new-password" : "current-password"}
            placeholder="••••"
            required
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-ember/20 px-3 py-2 text-sm text-gold shake">
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} className="btn btn-ember mt-5 w-full">
        {busy ? "One moment…" : isRegister ? "Create Account" : "Sign In"}
      </button>
    </form>
  );
}

export default function AuthPage() {
  return (
    <ScreenShell
      back="/"
      title="Join the Camp"
      subtitle="Your account is stored on this machine only — nothing leaves your network."
    >
      <Suspense fallback={<p className="text-center text-sm text-cream/60">Loading…</p>}>
        <AuthForm />
      </Suspense>
    </ScreenShell>
  );
}
