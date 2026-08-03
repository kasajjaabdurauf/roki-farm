"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { KeyRound, Loader2, LogIn, Mail, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import { signInWithEmail, signInWithMagicLink, signUp } from "@/lib/remote";
import { Button, Card, Field, Input } from "@/components/ui";
import { Wordmark } from "@/components/brand";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        const { error } = await signUp(email, password);
        if (error) throw new Error(error.message);
        setNotice("Account created. Check your inbox to confirm your email, then sign in.");
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

      <p className="text-center text-[13px] text-stone-500">
        Want to look around without an account?{" "}
        <Link href="/" className="font-semibold text-forest-700 underline">
          Continue in demo mode
        </Link>
      </p>
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
