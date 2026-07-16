"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { completePasswordReset } from "@/app/actions/password-reset";
import { MIN_PASSWORD_LENGTH } from "@/lib/credentials";

export function ResetPasswordForm({
  token,
  username,
}: {
  token: string;
  username: string | null;
}) {
  const [pw, setPw] = React.useState("");
  const [pw2, setPw2] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState<{ loginUrl: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.length < MIN_PASSWORD_LENGTH)
      return setError(`Use at least ${MIN_PASSWORD_LENGTH} characters`);
    if (pw !== pw2) return setError("Passwords don't match");

    setLoading(true);
    try {
      const res = await completePasswordReset({ token, password: pw });
      if (!res.ok) {
        setError(res.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      setDone({ loginUrl: res.loginUrl ?? "/login" });
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <div className="text-sm text-text-primary bg-success/10 border border-success/30 rounded-xl px-3 py-3">
          <p className="font-medium">Password updated</p>
          <p className="text-text-muted mt-1">
            Sign in with your new password
            {username ? (
              <>
                {" "}
                and username{" "}
                <span className="font-mono text-text-primary">{username}</span>
              </>
            ) : null}
            .
          </p>
        </div>
        <Link
          href={done.loginUrl}
          className="btn-base outline-none bg-gold text-black hover:bg-gold-300 h-12 px-5 text-base w-full"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {username && (
        <p className="text-xs text-text-muted -mb-1">
          Account: <span className="font-mono text-text-primary">{username}</span>
        </p>
      )}
      <Input
        type="password"
        label="New password"
        autoComplete="new-password"
        placeholder="••••••••"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        required
        autoFocus
      />
      <Input
        type="password"
        label="Confirm new password"
        autoComplete="new-password"
        placeholder="••••••••"
        value={pw2}
        onChange={(e) => setPw2(e.target.value)}
        required
      />

      {error && (
        <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5">
          {error}
        </div>
      )}

      <Button type="submit" loading={loading} className="w-full mt-2 h-12">
        Set new password
      </Button>
    </form>
  );
}
