"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { KeyRound, Loader2, LogIn, Mail, ShieldCheck, Sparkles, Sprout, UserPlus, Users, UserCog } from "lucide-react";
import { matchesAgentCode, setRole, useDb } from "@/lib/db";
import { remoteConfigured, resetPasswordForEmail, signInWithEmail, signInWithMagicLink, signUp } from "@/lib/remote";
import { Button, Card, Field, Input } from "@/components/ui";
import { Wordmark } from "@/components/brand";

export default function LoginPage() {
  const router = useRouter();
  const db = useDb();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [agentCode, setAgentCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupRole, setSignupRole] = useState<"FIELD_AGENT" | "FARMER">("FIELD_AGENT");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await signUp(email, password, signupRole);
        if (error) throw new Error(error.message);
        setNotice(
          signupRole === "FARMER"
            ? "Farmer account created. Confirm your email, then sign in. An administrator will link your account to your farmer profile."
            : "Field agent account created. Confirm your email, then sign in. Your administrator can adjust your role in Settings → Team & roles."
        );
        setMode("signin");
      } else {
        const { error } = await signInWithEmail(email, password);
        if (error) throw new Error(error.message);
        router.replace("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function onAgentCode(e: FormEvent) {
    e.preventDefault();
    if (matchesAgentCode(agentCode)) {
      // remember the agent session for this browser (skips this screen next time)
      try {
        localStorage.setItem("roki-agent-session", "1");
      } catch { /* ignore */ }
      setRole("FIELD_AGENT");
      router.push("/");
    } else {
      setError("That access code is not recognised. Check with your administrator.");
    }
  }

  async function onForgot() {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const { error } = await resetPasswordForEmail(email);
      if (error) throw new Error(error.message);
      setNotice("Password reset link sent! Check your inbox (and spam folder) and tap it to choose a new password.");
      setForgotOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset link.");
    } finally {
      setBusy(false);
    }
  }

  async function onMagicLink() {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const { error } = await signInWithMagicLink(email);
      if (error) throw new Error(error.message);
      setNotice("Magic link sent! Check your inbox (and spam folder) and tap it to sign in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send magic link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 py-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <Wordmark />
        <p className="text-sm text-stone-500">
          Farmer registration surveys, production forecasting and export supply planning.
        </p>
      </div>

      {db.meta.role !== "FIELD_AGENT" && (
        <Card className="p-5">
          <div className="mb-1 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-ochre-50 text-ochre-700">
              <UserCog className="h-4.5 w-4.5" />
            </span>
            <p className="font-display text-base font-semibold text-forest-900">Field agent? Use the access code</p>
          </div>
          <p className="mb-3 text-[12.5px] leading-snug text-stone-500">
            No account needed. Enter the shared field-agent access code from your administrator to continue.
          </p>
          <form onSubmit={onAgentCode} className="flex gap-2">
            <Input
              value={agentCode}
              onChange={(e) => setAgentCode(e.target.value)}
              placeholder="Enter access code"
              autoComplete="off"
              className="h-11 flex-1 text-sm"
            />
            <Button type="submit" variant="accent" size="sm" className="h-11 shrink-0">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCog className="h-4 w-4" />} Continue
            </Button>
          </form>
        </Card>
      )}

      <Card className="p-6">
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1">
          <button
            onClick={() => { setMode("signin"); setError(""); setNotice(""); }}
            className={
              "flex h-11 items-center justify-center gap-2 rounded-lg text-[13px] font-semibold transition-colors " +
              (mode === "signin" ? "bg-white text-forest-900 shadow-sm" : "text-stone-500")
            }
          >
            <LogIn className="h-4 w-4" /> Sign in
          </button>
          <button
            onClick={() => { setMode("signup"); setError(""); setNotice(""); }}
            className={
              "flex h-11 items-center justify-center gap-2 rounded-lg text-[13px] font-semibold transition-colors " +
              (mode === "signup" ? "bg-white text-forest-900 shadow-sm" : "text-stone-500")
            }
          >
            <UserPlus className="h-4 w-4" /> Create account
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Email address" required>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </Field>

          {mode === "signin" && (
            <Field label="Password" required>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <div className="mt-1.5 text-right">
                <button
                  type="button"
                  onClick={() => { setForgotOpen((v) => !v); setError(""); setNotice(""); }}
                  className="text-[12.5px] font-semibold text-forest-700 underline hover:text-forest-800"
                >
                  Forgot password?
                </button>
              </div>
            </Field>
          )}

          {mode === "signin" && forgotOpen && (
            <div className="rounded-xl border border-forest-100 bg-forest-50/60 p-3.5">
              <p className="mb-2 text-[12.5px] font-semibold text-forest-800">
                We'll email you a link to set a new password.
              </p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="h-11 text-sm"
                />
                <Button type="button" variant="primary" size="sm" className="h-11 shrink-0" onClick={onForgot} disabled={busy || !email}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Send link
                </Button>
              </div>
            </div>
          )}
          {mode === "signup" && (
            <Field label="What best describes you?" required>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSignupRole("FIELD_AGENT")}
                  className={
                    "flex h-16 flex-col items-center justify-center gap-1 rounded-xl border text-center transition-colors " +
                    (signupRole === "FIELD_AGENT"
                      ? "border-forest-700 bg-forest-800 text-white"
                      : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50")
                  }
                >
                  <Users className="h-5 w-5" />
                  <span className="text-[12.5px] font-bold">Field agent</span>
                  <span className={signupRole === "FIELD_AGENT" ? "text-[10px] text-white/70" : "text-[10px] text-stone-400"}>
                    I work with Roki
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSignupRole("FARMER")}
                  className={
                    "flex h-16 flex-col items-center justify-center gap-1 rounded-xl border text-center transition-colors " +
                    (signupRole === "FARMER"
                      ? "border-ochre-500 bg-ochre-500 text-white"
                      : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50")
                  }
                >
                  <Sprout className="h-5 w-5" />
                  <span className="text-[12.5px] font-bold">Farmer</span>
                  <span className={signupRole === "FARMER" ? "text-[10px] text-white/80" : "text-[10px] text-stone-400"}>
                    I grow produce
                  </span>
                </button>
              </div>
              <p className="mt-1.5 text-[11.5px] leading-snug text-stone-400">
                Your role is locked to what you choose (or what an admin changes later). Admin accounts are only
                assigned by an existing administrator.
              </p>
            </Field>
          )}

          {mode === "signup" && (
            <Field label="Password" required hint="min 6 characters">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a password"
                autoComplete="new-password"
              />
            </Field>
          )}

          {error && (
            <p className="rounded-xl bg-danger-bg px-3.5 py-2.5 text-[13px] font-semibold text-danger-dark">{error}</p>
          )}
          {notice && (
            <p className="rounded-xl bg-success-bg px-3.5 py-2.5 text-[13px] font-semibold text-success-dark">{notice}</p>
          )}

          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        {mode === "signin" && (
          <button
            onClick={onMagicLink}
            disabled={busy || !email}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-stone-300 text-[13px] font-semibold text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
          >
            <Mail className="h-4 w-4" /> Send magic link instead
          </button>
        )}
      </Card>

      <div className="grid gap-2.5 sm:grid-cols-3">
        <MiniCard icon={<ShieldCheck className="h-4 w-4" />} title="Bank-grade security" text="Row-level security, you only ever see data you're allowed to see." />
        <MiniCard icon={<Sparkles className="h-4 w-4" />} title="Works offline" text="Field agents keep working without network; sync happens automatically." />
        <MiniCard icon={<KeyRound className="h-4 w-4" />} title="Magic link" text="No password needed, sign in straight from your email." />
      </div>

      {!remoteConfigured() && (
        <Card className="p-4 text-center">
          <p className="text-[13px] font-semibold text-forest-800">Preview mode</p>
          <p className="mt-1 text-[12.5px] text-stone-500">
            No cloud connection is configured on this environment.{" "}
            <Link href="/" className="font-semibold text-forest-700 underline">Open the preview</Link> to browse
            sample data.
          </p>
        </Card>
      )}
    </div>
  );
}

function MiniCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-3.5">
      <p className="flex items-center gap-1.5 text-[13px] font-bold text-forest-800">{icon} {title}</p>
      <p className="mt-1 text-[12px] leading-snug text-stone-500">{text}</p>
    </div>
  );
}
