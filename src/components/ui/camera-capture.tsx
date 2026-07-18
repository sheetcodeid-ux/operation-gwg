"use client";

import * as React from "react";
import { Camera, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CapturedPhoto {
  file: File;
  url: string;
}

const stampText = () =>
  new Date().toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Draw the photo onto a canvas and burn a timestamp caption into the bottom bar. */
async function stampPhoto(file: File, prefix?: string): Promise<CapturedPhoto> {
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img: HTMLImageElement = await new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = dataUrl;
  });
  const maxW = 1280;
  const scale = Math.min(1, maxW / (img.width || maxW));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { file, url: URL.createObjectURL(file) };
  ctx.drawImage(img, 0, 0, w, h);

  const caption = [prefix, stampText()].filter(Boolean).join(" · ");
  const fs = Math.max(13, Math.round(w * 0.026));
  const pad = Math.round(w * 0.02);
  const barH = Math.round(fs * 1.9);
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, h - barH, w, barH);
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${fs}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText(caption, pad, h - barH / 2);

  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
  if (!blob) return { file, url: URL.createObjectURL(file) };
  const stamped = new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" });
  return { file: stamped, url: URL.createObjectURL(stamped) };
}

/** Take photos straight from the phone camera (rear), timestamp burned in.
 *  Enforces a minimum count with a clear indicator. */
export function CameraCapture({
  label,
  items,
  onChange,
  min = 3,
  stampPrefix,
}: {
  label: string;
  items: CapturedPhoto[];
  onChange: (items: CapturedPhoto[]) => void;
  min?: number;
  stampPrefix?: string;
}) {
  const [busy, setBusy] = React.useState(false);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setBusy(true);
    try {
      const stamped = await Promise.all(files.map((f) => stampPhoto(f, stampPrefix)));
      onChange([...items, ...stamped]);
    } catch {
      // Fall back to the raw files if canvas fails.
      onChange([...items, ...files.map((f) => ({ file: f, url: URL.createObjectURL(f) }))]);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  const ok = items.length >= min;
  return (
    <div className={cn("rounded-xl border p-2.5", ok ? "border-border bg-muted/20" : "border-amber-500/40 bg-amber-500/[0.05]")}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums", ok ? "bg-brand-500/12 text-brand-600 dark:text-brand-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400")}>
          {items.length}/{min}
        </span>
      </div>
      <label className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed border-border py-3 text-center text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
        {busy ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
        <span className="text-[11px] font-medium">Ambil Foto</span>
        <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={onFiles} disabled={busy} />
      </label>
      {items.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-1">
          {items.map((it, i) => (
            <div key={i} className="group relative aspect-square overflow-hidden rounded-md ring-1 ring-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.url} alt="" className="size-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="absolute right-0.5 top-0.5 grid size-4 place-items-center rounded bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="size-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
