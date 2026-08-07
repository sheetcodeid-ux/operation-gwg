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

/**
 * Gambar ulang foto ke kanvas dan BAKAR waktunya ke bilah bawah.
 *
 * Dibakar ke dalam gambar, bukan ditulis di sebelahnya, supaya waktunya ikut
 * ke mana pun fotonya diteruskan — bukti perbaikan yang bisa dipisahkan dari
 * waktunya bukan bukti apa-apa.
 */
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
  // Foto dokumentasi cukup terbaca, tidak perlu kualitas cetak. Dibatasi
  // 1024px supaya tiap berkas ~80–120 KB — penting saat 50 outlet mengunggah
  // ribuan foto tiap hari (hemat penyimpanan dan kuota).
  const maxW = 1024;
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

  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.62));
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
  max,
  stampPrefix,
}: {
  label: string;
  items: CapturedPhoto[];
  onChange: (items: CapturedPhoto[]) => void;
  min?: number;
  /** Hard cap on photos for this area (extra captures are ignored). */
  max?: number;
  stampPrefix?: string;
}) {
  const [busy, setBusy] = React.useState(false);
  const full = max != null && items.length >= max;

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    let files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    // Never exceed the per-area cap — keep only what still fits.
    if (max != null) {
      const room = Math.max(0, max - items.length);
      if (files.length > room) files = files.slice(0, room);
    }
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
    }
  }

  const ok = items.length >= min;
  return (
    <div className={cn("rounded-xl border p-2.5", ok ? "border-border bg-muted/20" : "border-amber-500/40 bg-amber-500/[0.05]")}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums", ok ? "bg-brand-500/12 text-brand-600 dark:text-brand-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400")}>
          {items.length}/{max ?? min}
        </span>
      </div>
      <label
        className={cn(
          "flex flex-col items-center gap-1 rounded-lg border border-dashed py-3 text-center transition-colors",
          full ? "cursor-not-allowed border-border/60 text-muted-foreground/40" : "cursor-pointer border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
        )}
      >
        {busy ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
        <span className="text-[11px] font-medium">{full ? `Maksimal ${max} foto` : "Ambil Foto"}</span>
        <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={onFiles} disabled={busy || full} />
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
