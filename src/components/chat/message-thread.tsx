"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, FileText, Info, Loader2, Paperclip, Send, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { clockTime, dayLabel, type ChatMessage, type ChatRef, type ChatThread } from "@/lib/chat-shared";

/**
 * Kolom tengah: judul percakapan, riwayat pesan, dan kotak tulis.
 *
 * Pesan dikelompokkan per hari, dan gelembung berurutan dari orang yang sama
 * digabung (avatar + nama hanya di gelembung pertama) supaya percakapan panjang
 * tetap enak dibaca.
 */
export function MessageThread({
  thread,
  messages,
  meId,
  sending,
  loading,
  onSend,
  onBack,
  onOpenDetail,
  className,
}: {
  thread: ChatThread;
  messages: ChatMessage[];
  meId: string;
  sending: boolean;
  loading: boolean;
  onSend: (body: string, files: File[]) => Promise<boolean>;
  onBack: () => void;
  onOpenDetail: () => void;
  className?: string;
}) {
  const [text, setText] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const boxRef = React.useRef<HTMLTextAreaElement>(null);
  const lastId = messages.at(-1)?.id ?? null;

  // Selalu turun ke pesan terbaru saat percakapan dibuka atau ada pesan masuk.
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [thread.id, lastId]);

  async function submit() {
    if (sending) return;
    if (!text.trim() && files.length === 0) return;
    const ok = await onSend(text, files);
    if (ok) {
      setText("");
      setFiles([]);
      boxRef.current?.focus();
    }
  }

  const solo = thread.others[0];

  return (
    <div className={cn("flex min-h-0 flex-col bg-background", className)}>
      {/* Kepala percakapan */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-3 py-2.5">
        <button
          type="button"
          onClick={onBack}
          className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted lg:hidden"
          aria-label="Kembali ke daftar"
        >
          <ArrowLeft className="size-5" />
        </button>

        {thread.kind === "group" ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground ring-1 ring-border">
            <Users className="size-4.5" />
          </span>
        ) : (
          <Avatar name={solo?.name ?? "?"} src={solo?.avatarUrl} size={36} />
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
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
        {loading && messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm font-medium text-foreground">Belum ada pesan</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Mulai percakapan dengan {thread.kind === "group" ? "grup ini" : thread.title}. Anda juga bisa meneruskan
              sebuah pengajuan dari halaman Pengajuan untuk dibahas di sini.
            </p>
          </div>
        ) : (
          <MessageGroups messages={messages} meId={meId} isGroup={thread.kind === "group"} />
        )}
        <div ref={bottomRef} />
      </div>

      {/* Kotak tulis */}
      <div className="shrink-0 border-t border-border bg-card p-3">
        {files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {files.map((f, i) => (
              <span
                key={`${f.name}-${i}`}
                className="flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-muted/40 py-1 pl-2 pr-1 text-[11px] text-foreground"
              >
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{f.name}</span>
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
          <label
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
            title="Lampirkan berkas"
          >
            <Paperclip className="size-5" />
            <input
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
          </label>

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
            className="max-h-32 min-h-9 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand-500"
          />

          <Button
            size="sm"
            onClick={submit}
            disabled={sending || (!text.trim() && files.length === 0)}
            className="size-9 shrink-0 p-0"
            aria-label="Kirim"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Pesan dikelompokkan per hari, lalu digabung per pengirim berurutan. */
function MessageGroups({ messages, meId, isGroup }: { messages: ChatMessage[]; meId: string; isGroup: boolean }) {
  const out: React.ReactNode[] = [];
  let lastDay = "";

  messages.forEach((m, i) => {
    const day = dayLabel(m.createdAt);
    if (day !== lastDay) {
      lastDay = day;
      out.push(
        <div key={`day-${m.id}`} className="my-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{day}</span>
          <span className="h-px flex-1 bg-border" />
        </div>,
      );
    }
    const prev = messages[i - 1];
    const grouped =
      !!prev && prev.senderId === m.senderId && dayLabel(prev.createdAt) === day &&
      Date.parse(m.createdAt) - Date.parse(prev.createdAt) < 5 * 60_000;

    out.push(<Bubble key={m.id} m={m} mine={m.senderId === meId} grouped={grouped} showName={isGroup} />);
  });

  return <div className="space-y-1">{out}</div>;
}

function Bubble({ m, mine, grouped, showName }: { m: ChatMessage; mine: boolean; grouped: boolean; showName: boolean }) {
  return (
    <div className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start", grouped ? "mt-0.5" : "mt-3")}>
      {!mine && (
        <span className="w-7 shrink-0">
          {!grouped && <Avatar name={m.senderName} size={28} />}
        </span>
      )}

      <div className={cn("flex max-w-[min(78%,34rem)] flex-col gap-1", mine ? "items-end" : "items-start")}>
        {!mine && showName && !grouped && (
          <span className="px-1 text-[11px] font-medium text-muted-foreground">{m.senderName}</span>
        )}

        {m.ref && <RequestCard r={m.ref} mine={mine} />}

        {m.attachments.length > 0 && (
          <div className={cn("flex w-full flex-col gap-1", mine ? "items-end" : "items-start")}>
            {m.attachments.map((a) => (
              <a
                key={a.path}
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
            ))}
          </div>
        )}

        {m.body && (
          <div
            className={cn(
              "whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm",
              mine
                ? "rounded-br-md bg-brand-500 text-white"
                : "rounded-bl-md border border-border bg-card text-foreground",
            )}
          >
            {m.body}
          </div>
        )}

        <span className="px-1 text-[10px] tabular-nums text-muted-foreground">{clockTime(m.createdAt)}</span>
      </div>
    </div>
  );
}

/** Kartu pengajuan yang diteruskan ke obrolan — bisa langsung dibuka. */
function RequestCard({ r, mine }: { r: ChatRef; mine: boolean }) {
  const body = (
    <>
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {r.kindLabel}
        </span>
        {!r.missing && <ExternalLink className="ml-auto size-3.5 shrink-0 text-muted-foreground" />}
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm font-semibold text-foreground">{r.title}</p>
      {!r.missing && (
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {r.requesterName} · <span className="font-medium text-foreground">{r.statusLabel}</span>
        </p>
      )}
      {r.missing && <p className="mt-0.5 text-[11px] text-muted-foreground">Catatannya sudah tidak ada.</p>}
    </>
  );

  const cls = cn(
    "block w-full max-w-full rounded-xl border p-3 text-left transition-colors",
    mine ? "border-brand-500/40 bg-brand-500/10" : "border-border bg-card",
    r.missing ? "opacity-70" : "hover:bg-muted/50",
  );

  if (r.missing) return <div className={cls}>{body}</div>;
  return (
    <Link href={r.href} className={cls}>
      {body}
    </Link>
  );
}
