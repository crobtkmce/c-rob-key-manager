import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyAuthError, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set a new password — C-ROB Smart Key Locker" },
      {
        name: "description",
        content: "Choose a new password for your C-ROB Smart Key Locker account.",
      },
      { property: "og:title", content: "Set a new password — C-ROB Smart Key Locker" },
      { property: "og:description", content: "Choose a new C-ROB Smart Key Locker password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!supabase) {
      setError("Password reset is not available until the Supabase project is connected.");
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(friendlyAuthError(updateError.message));
      return;
    }
    setDone(true);
    setTimeout(() => navigate({ to: "/member" }), 1200);
  }

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Open this page from the link in your reset email."
      footer={
        <Link to="/login" className="text-primary hover:underline">
          Back to login
        </Link>
      }
    >
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-center">
        <p className="text-sm font-medium text-amber-500">
          Email-based password reset is temporarily disabled during this testing phase.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Please log in using your Google account instead.
        </p>
      </div>

      {/* Temporarily disabled form
      {done ? (
        <p className="text-sm text-success">Password updated. Taking you to your dashboard…</p>
      ) : (
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {error ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" variant="crobPrimary" glow className="w-full" disabled={busy}>
            {busy ? "Updating…" : "Update password"}
          </Button>
        </form>
      )}
      */}
    </AuthLayout>
  );
}
