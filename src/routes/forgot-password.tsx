import { createFileRoute, Link } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { useState } from "react";

import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyAuthError, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password — C-ROB Smart Key Locker" },
      {
        name: "description",
        content: "Request a password reset link for your C-ROB Smart Key Locker account.",
      },
      { property: "og:title", content: "Reset password — C-ROB Smart Key Locker" },
      { property: "og:description", content: "Request a C-ROB Smart Key Locker reset link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supabase) {
      setError("Password reset is not available until the Supabase project is connected.");
      return;
    }
    setBusy(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (resetError) {
      setError(friendlyAuthError(resetError.message));
      return;
    }
    setSent(true);
  }

  return (
    <AuthLayout
      title="Forgot password"
      subtitle="We'll email you a link to set a new password."
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
      {sent ? (
        <div className="text-center">
          <MailCheck className="mx-auto size-10 text-accent" />
          <p className="mt-4 text-sm text-muted-foreground">
            If an account exists for <span className="text-foreground">{email}</span>, a reset link
            is on its way.
          </p>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="yourname@tkmce.ac.in"
            />
          </div>
          {error ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" variant="crobPrimary" glow className="w-full" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
      */}
    </AuthLayout>
  );
}
