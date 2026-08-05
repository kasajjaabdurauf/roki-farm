"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { getSession, updatePassword } from "@/lib/remote";
import { Button, Card, Field, Input } from "@/components/ui";
import { Wordmark } from "@/components/brand";

/**
 * Password recovery landing page. Supabase redirects here after the
 * "forgot password" email link is opened (with a recovery session).
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    getSession()
      .then((s) => setValid(!!s))
      .catch(() => setValid(false))
      .finally(() => setChecking(false));
  }, []);

  async function onSubmit() {
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await updatePassword(password);
      if (error) {
        // Common: the recovery link was opened without a valid session
        // (expired, or opened on another device). Give clear guidance.
        if (/session|recovery|expired|invalid|token/i.test(error.message)) {
          setError("This password-reset link has expired or was used on another device. Request a fresh reset link from the sign-in screen, then open it on THIS device.");
        } else {
          throw new Error(error.message);
        }
        setBusy(false);
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <Wordmark />
        <p className="text-sm text-stone-500">Choose a new password for your account.</p>
      </div>

      <Card className="p-6">
        {checking ? (
          <p className="flex items-center gap-2 py-6 text-center text-sm text-stone-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking your reset link…
          </p>
        ) : done ? (
          <div className="space-y-4 py-4 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-success-bg text-success-dark">
              <ShieldCheck className="h-7 w-7" />
            </span>
            <p className="font-display text-lg font-semibold text-forest-900">Password updated</p>
            <p className="text-sm text-stone-500">You can now sign in with your new password.</p>
            <Button variant="primary" className="w-full" onClick={() => router.replace("/login")}>
              Go to sign in
            </Button>
          </div>
        ) : !valid ? (
          <div className="space-y-4 py-4 text-center">
            <p className="font-display text-lg font-semibold text-forest-900">Link invalid or expired</p>
            <p className="text-sm text-stone-500">
              This password-reset link is not valid. Request a fresh one from the sign-in screen.
            </p>
            <Button variant="primary" className="w-full" onClick={() => router.replace("/login")}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void onSubmit();
            }}
          >
            <Field label="New password" required>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirm new password" required>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat the new password"
                autoComplete="new-password"
              />
            </Field>
            {error && (
              <p className="rounded-xl bg-danger-bg px-3.5 py-2.5 text-[13px] font-semibold text-danger-dark">{error}</p>
            )}
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Set new password
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
