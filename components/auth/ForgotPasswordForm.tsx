"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { requestPasswordReset } from "@/app/actions/password-reset";
import { PORTAL_LOGIN, type Portal } from "@/lib/types";

export function ForgotPasswordForm({ portal }: { portal: Portal }) {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return setError("Email is required");

    setLoading(true);
    try {
      const res = await requestPasswordReset({ email });
      if (!res.ok) {
        setError(res.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Deliberately identical whether or not the address matched an account —
  // anything else turns this form into a way to test which staff emails exist.
  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <div className="text-sm text-text-primary bg-success/10 border border-success/30 rounded-xl px-3 py-3">
          <p className="font-medium">Check your inbox</p>
          <p className="text-text-muted mt-1">
            If <span className="text-text-primary">{email.trim()}</span> is on an
            account, a reset link is on its way. It expires in 1 hour.
          </p>
        </div>
        <p className="text-xs text-text-muted">
          Nothing after a few minutes? Check your spam folder, or ask your admin to
          reset it for you.
        </p>
        <Link
          href={PORTAL_LOGIN[portal]}
          className="btn-base outline-none bg-surface text-text-primary border border-border hover:bg-surface-hover h-12 px-5 text-base w-full"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Input
        type="email"
        label="Email address"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        hint="The email saved on your account by your manager or admin."
        required
        autoFocus
      />

      {error && (
        <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5">
          {error}
        </div>
      )}

      <Button type="submit" loading={loading} className="w-full mt-2 h-12">
        Send reset link
      </Button>
    </form>
  );
}
