"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { CameraIcon, CheckIcon } from "@/components/ui/icons";
import { ProfilePhotoSheet } from "./ProfilePhotoSheet";

/**
 * App-only, shown once on the portal home right after the first password
 * change (`?welcome=photo`). The photo is optional; skipping is one tap.
 */
export function WelcomePhotoStep({
  onDone,
  onPhoto,
}: {
  onDone: () => void;
  onPhoto: (avatarUrl: string | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);

  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-bg flex flex-col items-center justify-center text-center px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-sm flex flex-col items-center">
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
          <CheckIcon size={16} /> Password updated
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Add photo"
          className="mt-8 h-32 w-32 rounded-full border-2 border-dashed border-gold/70 bg-surface text-gold flex items-center justify-center active:scale-[.97] transition-transform"
        >
          <CameraIcon size={40} />
        </button>
        <h2 className="mt-6 text-2xl font-semibold tracking-tight text-text-primary">Add a profile photo</h2>
        <p className="mt-2 text-sm text-text-muted leading-relaxed">
          Helps your manager and team recognise you. You can change it any time by tapping your photo at the top of the screen.
        </p>
        <Button onClick={() => setOpen(true)} size="lg" className="w-full mt-8" iconLeft={<CameraIcon size={18} />}>
          Add photo
        </Button>
        <button
          type="button"
          onClick={onDone}
          className="mt-2 w-full min-h-[48px] text-[15px] font-medium text-text-muted active:text-text-primary"
        >
          Skip for now
        </button>
        <div className="mt-6 flex items-center gap-1.5" aria-hidden>
          <span className="h-1 w-5 rounded-full bg-border-strong" />
          <span className="h-1 w-5 rounded-full bg-gold" />
        </div>
        <p className="mt-2 text-xs text-text-muted">Step 2 of 2</p>
      </div>
      <ProfilePhotoSheet
        open={open}
        onClose={close}
        hasPhoto={false}
        onChanged={(url) => {
          onPhoto(url);
          if (url) onDone();
        }}
      />
    </div>,
    document.body,
  );
}
