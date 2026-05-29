"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { CopyIcon, CheckIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";

export type Credentials = {
  username: string;
  password: string;
  loginUrl: string;
};

function CopyRow({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — select and copy manually.");
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
        <div className="font-mono text-sm text-text-primary truncate">{value}</div>
      </div>
      <button
        onClick={copy}
        className="flex-shrink-0 h-9 w-9 rounded-lg border border-border flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-hover"
        aria-label={`Copy ${label}`}
      >
        {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
      </button>
    </div>
  );
}

export function CredentialsModal({
  open,
  onClose,
  title,
  subtitle,
  credentials,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  credentials: Credentials | null;
}) {
  const toast = useToast();
  if (!credentials) return null;

  const fullLoginUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${credentials.loginUrl}`
      : credentials.loginUrl;

  async function copyAll() {
    const text = `Peckers login\nURL: ${fullLoginUrl}\nUsername: ${credentials!.username}\nPassword: ${credentials!.password}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("All details copied");
    } catch {
      toast.error("Couldn't copy");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={subtitle ?? "Share these with the person. The password is shown once here — use Reset later if it's lost."}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={copyAll}>
            Copy all
          </Button>
          <Button onClick={onClose}>Done</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <CopyRow label="Login URL" value={fullLoginUrl} />
        <CopyRow label="Username" value={credentials.username} />
        <CopyRow label="Password" value={credentials.password} />
        <p className="text-xs text-warning bg-warning/10 border border-warning/30 rounded-xl px-3 py-2">
          Make a note of the password now — for security it isn&apos;t shown again
          after you close this. You can reset it any time.
        </p>
      </div>
    </Modal>
  );
}
