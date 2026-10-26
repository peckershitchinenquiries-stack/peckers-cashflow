"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/ui/Toast";
import { CameraIcon, ImageIcon, TrashIcon } from "@/components/ui/icons";
import { removeOwnAvatar, uploadOwnAvatar } from "@/app/actions/avatar";

const OUTPUT_PX = 512;
const MAX_ZOOM = 4;

/**
 * App-only: choose, crop and save the signed-in person's profile photo.
 * The photo is cropped to a 512px square JPEG on the phone, so the upload is
 * small whatever the camera produced.
 */
export function ProfilePhotoSheet({
  open,
  onClose,
  hasPhoto,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  hasPhoto: boolean;
  onChanged?: (avatarUrl: string | null) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const galleryRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [removing, setRemoving] = React.useState(false);

  function pick(input: HTMLInputElement | null) {
    input?.click();
    onClose();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!chosen) return;
    if (!chosen.type.startsWith("image/")) {
      toast.error("Choose a photo, not another kind of file.");
      return;
    }
    setFile(chosen);
  }

  async function remove() {
    setRemoving(true);
    const res = await removeOwnAvatar();
    setRemoving(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Photo removed");
    onClose();
    onChanged?.(null);
    router.refresh();
  }

  const row =
    "w-full flex items-center gap-3 px-4 min-h-[52px] text-left text-[15px] font-medium active:bg-surface-hover disabled:opacity-60";

  return (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden" onChange={onFile} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

      <BottomSheet open={open} onClose={onClose}>
        <div className="flex flex-col gap-3 pt-1">
          <div className="text-center px-4">
            <p className="text-base font-semibold text-text-primary">Profile photo</p>
            <p className="text-xs text-text-muted mt-0.5">
              Optional. Your manager and team will see it.
            </p>
          </div>
          <div className="rounded-2xl bg-bg/60 border border-border divide-y divide-border overflow-hidden">
            <button type="button" onClick={() => pick(cameraRef.current)} className={row + " text-text-primary"}>
              <span className="text-gold"><CameraIcon size={18} /></span>
              Take photo
            </button>
            <button type="button" onClick={() => pick(galleryRef.current)} className={row + " text-text-primary"}>
              <span className="text-gold"><ImageIcon size={18} /></span>
              Choose from gallery
            </button>
            {hasPhoto && (
              <button type="button" onClick={remove} disabled={removing} className={row + " text-danger"}>
                <TrashIcon size={18} />
                {removing ? "Removing…" : "Remove photo"}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[48px] rounded-2xl border border-border text-[15px] font-medium text-text-primary active:bg-surface-hover"
          >
            Cancel
          </button>
        </div>
      </BottomSheet>

      {file && (
        <PhotoCropper
          file={file}
          onCancel={() => setFile(null)}
          onSaved={(url) => {
            setFile(null);
            onChanged?.(url);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

type Size = { w: number; h: number };
type Point = { x: number; y: number };

function PhotoCropper({
  file,
  onCancel,
  onSaved,
}: {
  file: File;
  onCancel: () => void;
  onSaved: (avatarUrl: string | null) => void;
}) {
  const toast = useToast();
  const imgRef = React.useRef<HTMLImageElement>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const pointers = React.useRef(new Map<number, Point>());
  const pinchFrom = React.useRef<{ dist: number; zoom: number } | null>(null);
  const [src, setSrc] = React.useState<string | null>(null);
  const [natural, setNatural] = React.useState<Size | null>(null);
  const [box, setBox] = React.useState(280);
  const [zoom, setZoom] = React.useState(1);
  const [pos, setPos] = React.useState<Point>({ x: 0, y: 0 });
  const [saving, setSaving] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  React.useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () =>
      setBox(Math.max(160, Math.min(stage.clientWidth - 48, stage.clientHeight - 48, 340)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [mounted]);

  // The smallest scale at which the photo still covers the whole circle.
  const baseScale = natural ? box / Math.min(natural.w, natural.h) : 1;
  const scale = baseScale * zoom;

  const clamp = React.useCallback(
    (p: Point, s: number): Point => {
      if (!natural) return p;
      const maxX = Math.max(0, (natural.w * s - box) / 2);
      const maxY = Math.max(0, (natural.h * s - box) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, p.x)),
        y: Math.min(maxY, Math.max(-maxY, p.y)),
      };
    },
    [natural, box],
  );

  const applyZoom = (z: number) => {
    const next = Math.min(MAX_ZOOM, Math.max(1, z));
    setZoom(next);
    setPos((p) => clamp(p, baseScale * next));
  };

  React.useEffect(() => {
    setPos((p) => clamp(p, scale));
  }, [clamp, scale]);

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinchFrom.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const now = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, now);
    if (pointers.current.size === 1) {
      setPos((p) => clamp({ x: p.x + now.x - prev.x, y: p.y + now.y - prev.y }, scale));
    } else if (pointers.current.size === 2 && pinchFrom.current) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchFrom.current.dist > 0) applyZoom(pinchFrom.current.zoom * (dist / pinchFrom.current.dist));
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchFrom.current = null;
  }

  async function save() {
    const img = imgRef.current;
    if (!img || !natural) return;
    setSaving(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_PX;
      canvas.height = OUTPUT_PX;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Your phone couldn't prepare the photo.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, OUTPUT_PX, OUTPUT_PX);
      const sx = (natural.w * scale) / 2 - pos.x - box / 2;
      const sy = (natural.h * scale) / 2 - pos.y - box / 2;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx / scale, sy / scale, box / scale, box / scale, 0, 0, OUTPUT_PX, OUTPUT_PX);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
      if (!blob) throw new Error("Your phone couldn't prepare the photo.");

      const form = new FormData();
      form.append("photo", blob, "avatar.jpg");
      const res = await uploadOwnAvatar(form);
      if (!res.ok) throw new Error(res.error);
      toast.success("Photo updated");
      onSaved(res.avatarUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your photo. Try again.");
      setSaving(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] bg-black text-white flex flex-col select-none pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="h-14 flex items-center px-2 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="h-10 px-3 rounded-full text-[15px] text-white/80 active:bg-white/10 disabled:opacity-50"
        >
          Cancel
        </button>
        <p className="flex-1 text-center text-[15px] font-semibold">Move and scale</p>
        <button
          type="button"
          onClick={save}
          disabled={saving || !natural}
          className="h-10 px-3 rounded-full text-[15px] font-semibold text-gold active:bg-white/10 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div
        ref={stageRef}
        className="relative flex-1 overflow-hidden touch-none cursor-grab"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {src && (
          // eslint-disable-next-line @next/next/no-img-element -- local blob preview, drawn to a canvas on save.
          <img
            ref={imgRef}
            src={src}
            alt=""
            draggable={false}
            onLoad={(e) =>
              setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
            }
            className="absolute left-1/2 top-1/2 max-w-none pointer-events-none"
            style={
              natural
                ? {
                    width: natural.w * scale,
                    height: natural.h * scale,
                    transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
                  }
                : { opacity: 0 }
            }
          />
        )}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/80 pointer-events-none"
          style={{ width: box, height: box, boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)" }}
        />
      </div>

      <div className="shrink-0 px-6 pt-4 pb-5 flex flex-col gap-3">
        <div className="flex items-center gap-3 text-white/70">
          <span className="text-lg leading-none" aria-hidden>−</span>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => applyZoom(Number(e.target.value))}
            aria-label="Zoom"
            className="flex-1 accent-gold"
          />
          <span className="text-lg leading-none" aria-hidden>+</span>
        </div>
        <p className="text-center text-xs text-white/60">Drag to move. Pinch or use the slider to zoom.</p>
      </div>
    </div>,
    document.body,
  );
}
