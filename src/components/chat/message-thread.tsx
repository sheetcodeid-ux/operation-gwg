"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CheckCheck, ExternalLink, FileText, Info, Loader2, Plus, Send, TriangleAlert, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { AttachMenu } from "./attach-menu";
import { RequestDetailSheet } from "./request-detail-sheet";
import { FollowupSheet } from "./followup-sheet";
import {
  clockTime,
  dayLabel,
  isImageAttachment,
  type ChatAttachment,
  type ChatMessage,
  type ChatRef,
  type ChatThread,
  type PickableRequest,
} from "@/lib/chat-shared";

/**
 * Kolom tengah: judul percakapan, riwayat pesan, dan kotak tulis.
 *
 * Pesan dikelompokkan per hari; gelembung berurutan dari orang yang sama
 * digabung (avatar dan nama hanya di gelembung pertama) supaya percakapan
 * panjang tetap enak dibaca.
 */
export function MessageThread({
  thread,
  messages,
  meId,
  sending,
  loading,
  pending,
  onSend,
  onBack,
  onOpenDetail,
  onRefresh,
  className,
}: {
  thread: ChatThread;
  messages: ChatMessage[];
  meId: string;
  sending: boolean;
  loading: boolean;
  /** Pesan yang sudah tampil di layar tapi belum dipastikan tersimpan. */
  pending: { id: string; body: string; ref: PickableRequest | null }[];
  onSend: (body: string, files: File[], ref: PickableRequest | null) => Promise<boolean>;
  onBack: () => void;
  onOpenDetail: () => void;
  /** Muat ulang percakapan — dipakai setelah temuan hygiene ditutup. */
  onRefresh: () => void;
  className?: string;
}) {
  const [text, setText] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [ref, setRef] = React.useState<PickableRequest | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const router = useRouter();
  const [openRequest, setOpenRequest] = React.useState<string | null>(null);
  const [openFollowup, setOpenFollowup] = React.useState<string | null>(null);
  const [photo, setPhoto] = React.useState<{ url: string; name: string } | null>(null);

  // Satu bentuk kartu, empat jenis isi.
  //
  // Pengajuan HC dan temuan hygiene punya panelnya sendiri di dalam obrolan.
  // Request System dan Dokumen HC belum punya, jadi kartunya membuka halaman
  // antreannya — BUKAN panel pengajuan. Sebelumnya semua yang bukan hygiene
  // diarahkan ke panel pengajuan, yang berarti jenis baru akan dicari di tabel
  // yang salah dan panelnya tampil kosong.
  const openRef = React.useCallback(
    (r: ChatRef) => {
      if (r.kind === "hygiene") setOpenFollowup(r.id);
      else if (r.kind === "system" || r.kind === "dokumen") router.push(r.href);
      else setOpenRequest(r.id);
    },
    [router],
  );
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const boxRef = React.useRef<HTMLTextAreaElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const lastId = messages.at(-1)?.id ?? null;

  // Selalu turun ke pesan terbaru saat percakapan dibuka atau ada pesan masuk.
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [thread.id, lastId, pending.length]);

  // Kotak tulis tumbuh mengikuti isinya, sampai batas tertentu.
  React.useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [text]);

  async function submit() {
    if (sending) return;
    if (!text.trim() && files.length === 0 && !ref) return;
    // Isian dikosongkan LEBIH DULU supaya mengetik terasa langsung; kalau
    // pengirimannya gagal, teksnya dikembalikan.
    const body = text;
    const keptFiles = files;
    const keptRef = ref;
    setText("");
    setFiles([]);
    setRef(null);
    const ok = await onSend(body, keptFiles, keptRef);
    if (!ok) {
      setText(body);
      setFiles(keptFiles);
      setRef(keptRef);
    }
    boxRef.current?.focus();
  }

  const solo = thread.others[0];

  return (
    <div className={cn("flex min-h-0 flex-col bg-background", className)}>
      {/* Kepala percakapan */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card/60 px-3 py-2.5 backdrop-blur-sm sm:px-4">
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted lg:hidden"
          aria-label="Kembali ke daftar"
        >
          <ArrowLeft className="size-5" />
        </button>

        {thread.kind === "group" ? (
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-500/10 text-brand-600 ring-1 ring-border dark:text-brand-400">
            <Users className="size-5" />
          </span>
        ) : (
          <Avatar name={solo?.name ?? "?"} src={solo?.avatarUrl} size={40} />
        )}

        <button type="button" onClick={onOpenDetail} className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-semibold text-foreground">{thread.title}</p>
          <p className="truncate text-[11px] text-muted-foreground">{thread.subtitle}</p>
        </button>

        <button
          type="button"
          onClick={onOpenDetail}
          className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted xl:hidden"
          aria-label="Info percakapan"
        >
          <Info className="size-5" />
        </button>
      </header>

      {/* Riwayat */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-6">
        {loading && messages.length === 0 ? (
          <ThreadSkeleton />
        ) : messages.length === 0 && pending.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-sm font-medium text-foreground">Belum ada pesan</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Mulai percakapan dengan {thread.kind === "group" ? "grup ini" : thread.title}. Tekan{" "}
              <Plus className="inline size-3" /> untuk melampirkan foto, dokumen, atau meneruskan sebuah pengajuan.
            </p>
          </div>
        ) : (
          <>
            <MessageGroups
              messages={messages}
              meId={meId}
              isGroup={thread.kind === "group"}
              onOpenRef={openRef}
              onOpenPhoto={(url, name) => setPhoto({ url, name })}
            />
            {pending.map((p) => (
              <PendingBubble key={p.id} body={p.body} request={p.ref} />
            ))}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      <RequestDetailSheet requestId={openRequest} onClose={() => setOpenRequest(null)} />
      <FollowupSheet
        followupId={openFollowup}
        meId={meId}
        onClose={() => setOpenFollowup(null)}
        onResolved={onRefresh}
      />
      <PhotoLightbox photo={photo} onClose={() => setPhoto(null)} />

      {/* Kotak tulis */}
      <div className="relative shrink-0 border-t border-border bg-card px-3 py-2.5 sm:px-4">
        {ref && (
          <div className="mb-2 flex items-start gap-2 rounded-xl border border-brand-500/40 bg-brand-500/5 p-2.5">
            <span className="mt-0.5 rounded-md bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              {ref.kindLabel}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{ref.title}</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {ref.requesterName} · {ref.statusLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRef(null)}
              className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted"
              aria-label="Batalkan lampiran pengajuan"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {files.map((f, i) => (
              <span
                key={`${f.name}-${i}`}
                className="flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-muted/40 py-1 pl-2 pr-1 text-[11px] text-foreground"
              >
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="max-w-40 truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}
                  className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted"
                  aria-label={`Buang ${f.name}`}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Lampirkan"
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full transition-all",
                menuOpen ? "rotate-45 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              <Plus className="size-5" />
            </button>
            <AttachMenu
              open={menuOpen}
              onOpenChange={setMenuOpen}
              onPickFiles={(accept) => {
                if (fileRef.current) {
                  fileRef.current.accept = accept;
                  fileRef.current.click();
                }
              }}
              onPickRequest={(r) => setRef(r)}
            />
          </div>

          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              const tooBig = picked.filter((f) => f.size > 10 * 1024 * 1024);
              if (tooBig.length > 0) toast.error(`${tooBig[0].name} melebihi 10 MB.`);
              setFiles((cur) => [...cur, ...picked.filter((f) => f.size <= 10 * 1024 * 1024)]);
              e.target.value = "";
            }}
          />

          <textarea
            ref={boxRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter mengirim, Shift+Enter ganti baris — kebiasaan aplikasi pesan.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="Tulis pesan…"
            className="no-scrollbar max-h-32 min-h-9 flex-1 resize-none overflow-y-auto rounded-2xl border border-border bg-background px-4 py-2 text-sm leading-5 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand-500"
          />

          <button
            type="button"
            onClick={submit}
            disabled={sending || (!text.trim() && files.length === 0 && !ref)}
            aria-label="Kirim"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-500 text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Rangka sementara saat riwayat sedang dimuat — lebih tenang daripada spinner. */
function ThreadSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className={cn("flex", i % 2 ? "justify-end" : "justify-start")}>
          <div
            className="h-9 animate-pulse rounded-2xl bg-muted"
            style={{ width: `${[52, 38, 64, 30, 46][i]}%` }}
          />
        </div>
      ))}
    </div>
  );
}

/** Pesan dikelompokkan per hari, lalu digabung per pengirim berurutan. */
function MessageGroups({
  messages,
  meId,
  isGroup,
  onOpenRef,
  onOpenPhoto,
}: {
  messages: ChatMessage[];
  meId: string;
  isGroup: boolean;
  onOpenRef: (ref: ChatRef) => void;
  onOpenPhoto: (url: string, name: string) => void;
}) {
  const out: React.ReactNode[] = [];
  let lastDay = "";

  messages.forEach((m, i) => {
    const day = dayLabel(m.createdAt);
    if (day !== lastDay) {
      lastDay = day;
      out.push(
        <div key={`day-${m.id}`} className="my-4 flex justify-center">
          <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-medium text-muted-foreground">{day}</span>
        </div>,
      );
    }
    const prev = messages[i - 1];
    const grouped =
      !!prev &&
      prev.senderId === m.senderId &&
      dayLabel(prev.createdAt) === day &&
      Date.parse(m.createdAt) - Date.parse(prev.createdAt) < 5 * 60_000;

    out.push(
      <Bubble
        key={m.id}
        m={m}
        mine={m.senderId === meId}
        grouped={grouped}
        showName={isGroup}
        onOpenRef={onOpenRef}
        onOpenPhoto={onOpenPhoto}
      />,
    );
  });

  return <div>{out}</div>;
}

function Bubble({
  m,
  mine,
  grouped,
  showName,
  onOpenRef,
  onOpenPhoto,
}: {
  m: ChatMessage;
  mine: boolean;
  grouped: boolean;
  showName: boolean;
  onOpenRef: (ref: ChatRef) => void;
  onOpenPhoto: (url: string, name: string) => void;
}) {
  return (
    <div className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start", grouped ? "mt-0.5" : "mt-3")}>
      {!mine && <span className="w-7 shrink-0">{!grouped && <Avatar name={m.senderName} size={28} />}</span>}

      <div className={cn("flex max-w-[min(80%,36rem)] flex-col gap-1", mine ? "items-end" : "items-start")}>
        {!mine && showName && !grouped && (
          <span className="px-1 text-[11px] font-medium text-muted-foreground">{m.senderName}</span>
        )}

        {m.ref && <RequestCard r={m.ref} mine={mine} onOpen={onOpenRef} />}

        {m.attachments.length > 0 && (
          <div className={cn("flex w-full flex-col gap-1", mine ? "items-end" : "items-start")}>
            {m.attachments.map((a) => (
              <Attachment key={a.path} a={a} mine={mine} onOpenPhoto={onOpenPhoto} />
            ))}
          </div>
        )}

        {m.body && (
          <div
            className={cn(
              "whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm",
              mine ? "rounded-br-md bg-brand-500 text-white" : "rounded-bl-md border border-border bg-card text-foreground",
            )}
          >
            {m.body}
          </div>
        )}

        <span className="flex items-center gap-1 px-1 text-[10px] tabular-nums text-muted-foreground">
          {clockTime(m.createdAt)}
          {mine && <CheckCheck className="size-3" />}
        </span>
      </div>
    </div>
  );
}

/** Gelembung sementara: sudah terlihat, belum dipastikan tersimpan. */
function PendingBubble({ body, request: r }: { body: string; request: PickableRequest | null }) {
  return (
    <div className="mt-3 flex items-end justify-end gap-2">
      <div className="flex max-w-[min(80%,36rem)] flex-col items-end gap-1 opacity-60">
        {r && (
          <div className="w-full rounded-xl border border-brand-500/40 bg-brand-500/10 p-3">
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {r.kindLabel}
            </span>
            <p className="mt-1.5 line-clamp-2 text-sm font-semibold text-foreground">{r.title}</p>
          </div>
        )}
        {body && (
          <div className="whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-brand-500 px-3.5 py-2 text-sm leading-relaxed text-white">
            {body}
          </div>
        )}
        <span className="flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
          Mengirim <Check className="size-3" />
        </span>
      </div>
    </div>
  );
}

/** Lampiran: foto jadi kotak yang bisa diperbesar, sisanya kartu berkas. */
function Attachment({
  a,
  mine,
  onOpenPhoto,
}: {
  a: ChatAttachment;
  mine: boolean;
  onOpenPhoto: (url: string, name: string) => void;
}) {
  // Foto dibuka DI DALAM aplikasi, bukan tab baru: membuka tab berarti keluar
  // dari percakapan, dan kembali ke sana butuh dua langkah lagi.
  if (isImageAttachment(a) && a.url) {
    const url = a.url;
    return (
      <button
        type="button"
        onClick={() => onOpenPhoto(url, a.name)}
        className="block overflow-hidden rounded-xl ring-1 ring-border transition-opacity hover:opacity-90"
      >
        {/* Foto obrolan sudah dikompres saat diunggah — lewati optimisasi gambar. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={a.name}
          loading="lazy"
          className="h-auto max-h-80 w-auto max-w-[15rem] object-contain sm:max-w-[18rem]"
        />
      </button>
    );
  }

  return (
    <a
      href={a.url ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex max-w-full items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-colors",
        a.url ? "hover:bg-muted/60" : "pointer-events-none opacity-60",
        mine ? "border-brand-500/30 bg-brand-500/10" : "border-border bg-card",
      )}
    >
      <FileText className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate text-foreground">{a.name}</span>
    </a>
  );
}

/**
 * Kartu rujukan di dalam obrolan — pengajuan atau temuan hygiene.
 *
 * Menekannya membuka detail DI ATAS percakapan, bukan berpindah halaman.
 * Temuan hygiene yang belum ditutup ditandai MERAH: itu tugas yang menggantung,
 * bukan sekadar lampiran.
 */
function RequestCard({ r, mine, onOpen }: { r: ChatRef; mine: boolean; onOpen: (ref: ChatRef) => void }) {
  const alert = r.tone === "red";
  const warn = r.tone === "amber";
  const done = r.tone === "emerald";

  const body = (
    <>
      {r.photoUrl && (
        <span className="mb-2 flex justify-center overflow-hidden rounded-lg bg-muted/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.photoUrl} alt={r.title} loading="lazy" className="max-h-44 w-auto max-w-full object-contain" />
        </span>
      )}
      <span className="flex items-center gap-2">
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            alert
              ? "bg-red-500/15 text-red-700 dark:text-red-300"
              : warn
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                : done
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "bg-muted text-muted-foreground",
          )}
        >
          {r.kindLabel}
        </span>
        {!r.missing && <ExternalLink className="ml-auto size-3.5 shrink-0 text-muted-foreground" />}
      </span>
      <span className="mt-1.5 line-clamp-2 block text-sm font-semibold text-foreground">{r.title}</span>
      {r.missing ? (
        <span className="mt-0.5 block text-[11px] text-muted-foreground">Catatannya sudah tidak ada.</span>
      ) : (
        <span
          className={cn(
            "mt-1 flex items-center gap-1 text-[11px]",
            alert
              ? "font-semibold text-red-600 dark:text-red-400"
              : warn
                ? "font-semibold text-amber-600 dark:text-amber-400"
                : "text-muted-foreground",
          )}
        >
          {alert && <TriangleAlert className="size-3 shrink-0" />}
          {alert || warn ? r.statusLabel : `${r.requesterName} · ${r.statusLabel}`}
        </span>
      )}
    </>
  );

  const cls = cn(
    "block w-full max-w-full rounded-xl border p-3 text-left transition-colors",
    alert
      ? "border-red-500/50 bg-red-500/5"
      : warn
        ? "border-amber-500/50 bg-amber-500/5"
        : mine
          ? "border-brand-500/40 bg-brand-500/10"
          : "border-border bg-card",
    r.missing ? "opacity-70" : "hover:bg-muted/50",
  );

  if (r.missing) return <div className={cls}>{body}</div>;
  return (
    <button type="button" onClick={() => onOpen(r)} className={cls}>
      {body}
    </button>
  );
}

/** Foto diperbesar di dalam aplikasi, bukan tab baru. */
function PhotoLightbox({ photo, onClose }: { photo: { url: string; name: string } | null; onClose: () => void }) {
  React.useEffect(() => {
    if (!photo) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [photo, onClose]);

  if (!photo) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Tutup"
        className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <X className="size-5" />
      </button>
      <div className="flex max-h-full flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={photo.name} className="max-h-[82dvh] w-auto max-w-full object-contain" />
        <p className="max-w-full truncate text-xs text-white/70">{photo.name}</p>
      </div>
    </div>
  );
}
