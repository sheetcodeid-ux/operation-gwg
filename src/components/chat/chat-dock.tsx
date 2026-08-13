"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2, Maximize2, Minus, Palette, Send, X } from "lucide-react";
import { toast } from "sonner";
import { chatOpenAction, chatPickableRequestsAction, chatPollAction, chatSendAction } from "@/lib/actions/chat";
import type { ChatMessage, ChatThread, PickableRequest } from "@/lib/chat-shared";
import { Avatar } from "@/components/ui/avatar";
import { fromNow } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Jendela obrolan kecil yang mengambang di sudut layar.
 *
 * Balasan singkat tidak sepadan dengan meninggalkan halaman. Sebelumnya satu
 * pertanyaan "sudah dikirim belum?" berarti keluar dari antrian yang sedang
 * dikerjakan, membalas, lalu mencari kembali posisi semula — dan pekerjaan
 * yang sedang berjalan hilang konteksnya.
 *
 * Dua batas yang disengaja:
 *
 *  • Maksimal tiga jendela sekaligus. Facebook membiarkannya menumpuk sampai
 *    memenuhi layar; di aplikasi kerja itu justru menutupi tabel yang sedang
 *    dibaca. Yang paling lama otomatis ditutup.
 *  • Di layar sempit jendelanya TIDAK dipakai sama sekali — orangnya dibawa
 *    ke halaman Pesan. Jendela 336px di layar 360px bukan jendela mengambang,
 *    itu halaman penuh yang menyamar.
 */

const MAX_WINDOWS = 3;
const POLL_MS = 8000;
/** Di bawah lebar ini, jendela mengambang tidak masuk akal. */
const MIN_WIDTH = 640;

interface DockedThread {
  id: string;
  title: string;
  subtitle: string;
  avatarUrl?: string | null;
  /** Dikecilkan jadi bilah judul saja. */
  minimized: boolean;
}

interface DockApi {
  open: (t: { id: string; title: string; subtitle?: string; avatarUrl?: string | null }) => void;
}

const Ctx = React.createContext<DockApi | null>(null);

/** Buka percakapan di jendela mengambang dari mana pun di aplikasi. */
export function useChatDock(): DockApi {
  const api = React.useContext(Ctx);
  // Tanpa penjaga ini, memakai hook di luar provider gagal diam-diam: tombolnya
  // terlihat normal tapi tidak melakukan apa-apa.
  if (!api) throw new Error("useChatDock dipakai di luar <ChatDockProvider>");
  return api;
}

export function ChatDockProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [threads, setThreads] = React.useState<DockedThread[]>([]);
  const [wide, setWide] = React.useState(true);

  React.useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${MIN_WIDTH}px)`);
    const sync = () => {
      setWide(mq.matches);
      // Layar menyempit selagi ada jendela terbuka (rotasi HP, jendela
      // peramban diperkecil) ⇒ jendelanya ditutup, bukan dibiarkan menutupi
      // seluruh halaman. Ditangani DI SINI, di penangan perubahannya, bukan
      // sebagai efek yang menonton `wide` — efek yang memanggil setState
      // langsung memicu render berantai.
      if (!mq.matches) setThreads([]);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const open = React.useCallback<DockApi["open"]>(
    (t) => {
      if (!wide) {
        router.push(`/pesan?t=${t.id}`);
        return;
      }
      setThreads((cur) => {
        const ada = cur.find((x) => x.id === t.id);
        // Sudah terbuka ⇒ munculkan lagi, jangan digandakan.
        if (ada) return cur.map((x) => (x.id === t.id ? { ...x, minimized: false } : x));
        const baru: DockedThread = {
          id: t.id,
          title: t.title,
          subtitle: t.subtitle ?? "",
          avatarUrl: t.avatarUrl ?? null,
          minimized: false,
        };
        // Yang paling lama dibuang lebih dulu.
        return [...cur, baru].slice(-MAX_WINDOWS);
      });
    },
    [wide, router],
  );

  const api = React.useMemo<DockApi>(() => ({ open }), [open]);

  const close = (id: string) => setThreads((cur) => cur.filter((t) => t.id !== id));
  const toggleMin = (id: string) =>
    setThreads((cur) => cur.map((t) => (t.id === id ? { ...t, minimized: !t.minimized } : t)));

  return (
    <Ctx.Provider value={api}>
      {children}
      {threads.length > 0 && (
        <ChatDock threads={threads} onClose={close} onToggleMinimize={toggleMin} />
      )}
    </Ctx.Provider>
  );
}

function ChatDock({
  threads,
  onClose,
  onToggleMinimize,
}: {
  threads: DockedThread[];
  onClose: (id: string) => void;
  onToggleMinimize: (id: string) => void;
}) {
  // Diportal ke <body>: dirender di tempatnya, jendelanya akan terjebak di
  // dalam pembungkus ber-overflow atau ber-backdrop-filter milik halaman.
  //
  // Tidak perlu penanda "sudah terpasang" seperti komponen berportal lain:
  // komponen ini HANYA dirender saat ada jendela terbuka, dan jendela hanya
  // terbuka lewat klik. Saat render di server maupun hidrasi pertama,
  // daftarnya selalu kosong sehingga `document` tidak pernah disentuh di sana.
  return createPortal(
    <div className="no-print pointer-events-none fixed bottom-0 right-4 z-[70] flex items-end gap-3">
      {threads.map((t) => (
        <ChatWindow
          key={t.id}
          thread={t}
          onClose={() => onClose(t.id)}
          onToggleMinimize={() => onToggleMinimize(t.id)}
        />
      ))}
    </div>,
    document.body,
  );
}

function ChatWindow({
  thread,
  onClose,
  onToggleMinimize,
}: {
  thread: DockedThread;
  onClose: () => void;
  onToggleMinimize: () => void;
}) {
  const router = useRouter();
  const [messages, setMessages] = React.useState<ChatMessage[] | null>(null);
  const [meId, setMeId] = React.useState<string | null>(null);
  const [body, setBody] = React.useState("");
  const [sending, setSending] = React.useState(false);
  /**
   * Pengajuan design yang ikut dilampirkan.
   *
   * Ini yang membuat jendela kecil setara dengan halaman Pesan untuk pekerjaan
   * sehari-hari: menanyakan revisi tanpa melampirkan pengajuannya berarti tim
   * Creative menerima pesan yang tidak jelas menunjuk brief yang mana — persis
   * keluhan yang masuk.
   */
  const [ref, setRef] = React.useState<PickableRequest | null>(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pick, setPick] = React.useState<PickableRequest[] | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const load = React.useCallback(async () => {
    const res = await chatOpenAction(thread.id);
    if (!res) return;
    setMessages(res.messages);
    // Peserta lain sudah diketahui; yang belum adalah "saya siapa". Pesan yang
    // pengirimnya bukan salah satu peserta lain berarti milik saya.
    const lain = new Set(res.people.map((p) => p.id));
    const mine = res.messages.find((m) => !lain.has(m.senderId));
    if (mine) setMeId(mine.senderId);
  }, [thread.id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Penyegaran berkala hanya selagi tab terlihat — jendela yang tertinggal
  // terbuka di latar tidak boleh jadi permintaan paling sering di aplikasi.
  React.useEffect(() => {
    if (thread.minimized) return;
    let stop = false;
    const tick = async () => {
      if (stop || document.visibilityState !== "visible") return;
      const rows = await chatPollAction(thread.id);
      if (!stop && rows) setMessages(rows);
    };
    const id = setInterval(tick, POLL_MS);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [thread.id, thread.minimized]);

  React.useEffect(() => {
    if (!thread.minimized) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, thread.minimized]);

  async function kirim() {
    const teks = body.trim();
    // Melampirkan pengajuan saja sudah cukup — catatannya boleh kosong.
    if ((!teks && !ref) || sending) return;
    setSending(true);
    // Kosongkan lebih dulu supaya balasan berikutnya bisa langsung diketik;
    // dikembalikan kalau gagal, jadi tidak ada tulisan yang hilang.
    const lampiran = ref;
    setBody("");
    setRef(null);
    const res = await chatSendAction({ threadId: thread.id, body: teks, refRequestId: lampiran?.id ?? null });
    setSending(false);
    if (res.error) {
      setBody(teks);
      setRef(lampiran);
      return toast.error(res.error);
    }
    void load();
  }

  async function bukaPemilih() {
    const buka = !pickerOpen;
    setPickerOpen(buka);
    // Daftarnya diambil saat pertama dibuka saja — jendela obrolan bisa ada
    // tiga sekaligus, dan tidak satu pun perlu memuatnya sebelum dipakai.
    if (buka && pick === null) setPick(await chatPickableRequestsAction("design"));
  }

  return (
    <div
      className={cn(
        "pointer-events-auto flex w-[21rem] flex-col overflow-hidden rounded-t-xl border border-border bg-card shadow-2xl",
        thread.minimized ? "h-auto" : "h-[26rem]",
      )}
    >
      {/* Kepala — klik di mana saja untuk mengecilkan/membesarkan. */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/40 px-2.5 py-2">
        <button
          type="button"
          onClick={onToggleMinimize}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={!thread.minimized}
        >
          <Avatar name={thread.title} src={thread.avatarUrl} size={26} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-foreground">{thread.title}</span>
            {thread.subtitle && (
              <span className="block truncate text-[10.5px] text-muted-foreground">{thread.subtitle}</span>
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={() => router.push(`/pesan?t=${thread.id}`)}
          title="Buka detail di halaman Pesan"
          aria-label="Buka detail di halaman Pesan"
          className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Maximize2 className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onToggleMinimize}
          title={thread.minimized ? "Buka" : "Kecilkan"}
          aria-label={thread.minimized ? "Buka" : "Kecilkan"}
          className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Minus className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          title="Tutup"
          aria-label="Tutup obrolan"
          className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {!thread.minimized && (
        <>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2.5 py-2">
            {messages === null ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Memuat…</p>
            ) : messages.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Belum ada pesan. Sapa duluan.</p>
            ) : (
              messages.map((m) => {
                const saya = m.senderId === meId;
                return (
                  <div key={m.id} className={cn("flex", saya ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3 py-1.5",
                        saya ? "bg-brand-500 text-white" : "bg-muted text-foreground",
                      )}
                    >
                      {/* Lampiran & kartu rujukan sengaja TIDAK digambar di sini.
                          Jendela selebar 21rem tidak cukup memuatnya dengan
                          layak, dan menampilkannya setengah jadi lebih buruk
                          daripada mengarahkan ke halaman penuh. */}
                      {m.body ? (
                        <p className="whitespace-pre-wrap break-words text-[12.5px] leading-snug">{m.body}</p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => router.push(`/pesan?t=${thread.id}`)}
                          className={cn("text-[12.5px] italic underline-offset-2 hover:underline", saya ? "text-white/90" : "text-muted-foreground")}
                        >
                          {m.ref ? "Lampiran — buka di Pesan" : "Berkas — buka di Pesan"}
                        </button>
                      )}
                      <p className={cn("mt-0.5 text-[9.5px]", saya ? "text-white/70" : "text-muted-foreground")}>
                        {fromNow(m.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Daftar pengajuan design yang boleh ia lihat — cakupannya persis
              sama dengan halaman Pengajuan, jadi obrolan tidak jadi jalan
              memutar untuk melihat pengajuan cabang lain. */}
          {pickerOpen && (
            <div className="max-h-44 shrink-0 overflow-y-auto border-t border-border bg-muted/20">
              {pick === null ? (
                <p className="flex items-center justify-center gap-1.5 py-6 text-[11.5px] text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" /> Memuat pengajuan…
                </p>
              ) : pick.length === 0 ? (
                <p className="py-6 text-center text-[11.5px] text-muted-foreground">Belum ada pengajuan design.</p>
              ) : (
                pick.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setRef(r);
                      setPickerOpen(false);
                    }}
                    className="block w-full border-b border-border/50 px-2.5 py-1.5 text-left last:border-0 hover:bg-muted/60"
                  >
                    <p className="truncate text-[12px] font-medium text-foreground">{r.title}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {r.requesterName} · {r.statusLabel}
                    </p>
                  </button>
                ))
              )}
            </div>
          )}

          {ref && (
            <div className="flex shrink-0 items-center gap-2 border-t border-brand-500/30 bg-brand-500/5 px-2.5 py-1.5">
              <Palette className="size-3.5 shrink-0 text-brand-600 dark:text-brand-400" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11.5px] font-medium text-foreground">{ref.title}</span>
                <span className="block truncate text-[10px] text-muted-foreground">{ref.statusLabel}</span>
              </span>
              <button
                type="button"
                onClick={() => setRef(null)}
                aria-label="Batalkan lampiran pengajuan"
                className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </div>
          )}

          <div className="flex shrink-0 items-end gap-1.5 border-t border-border p-2">
            <button
              type="button"
              onClick={() => void bukaPemilih()}
              aria-label="Lampirkan pengajuan design"
              title="Lampirkan pengajuan design"
              aria-expanded={pickerOpen}
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-lg transition-colors",
                pickerOpen ? "bg-brand-500/15 text-brand-600 dark:text-brand-400" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Palette className="size-3.5" />
            </button>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                // Enter mengirim, Shift+Enter baris baru — kebiasaan yang sama
                // dengan aplikasi pesan lain.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void kirim();
                }
              }}
              rows={1}
              placeholder="Tulis pesan…"
              className="max-h-24 min-h-[2rem] flex-1 resize-none rounded-lg border border-input bg-background/60 px-2.5 py-1.5 text-[12.5px] outline-none placeholder:text-muted-foreground/70 focus:border-brand-500/60"
            />
            <button
              type="button"
              onClick={() => void kirim()}
              disabled={(!body.trim() && !ref) || sending}
              aria-label="Kirim"
              className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-500 text-white transition-opacity hover:bg-brand-600 disabled:opacity-40"
            >
              <Send className="size-3.5" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Satu baris percakapan di daftar dropdown lonceng chat. */
export function ThreadRow({ t, onPick }: { t: ChatThread; onPick: () => void }) {
  const solo = t.others[0];
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted/50"
    >
      <Avatar name={t.title} src={t.kind === "dm" ? solo?.avatarUrl : null} size={34} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className={cn("min-w-0 flex-1 truncate text-[13px]", t.unread > 0 ? "font-semibold text-foreground" : "text-foreground/85")}>
            {t.title}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">{fromNow(t.lastMessageAt)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn("min-w-0 flex-1 truncate text-[11.5px]", t.unread > 0 ? "text-foreground/80" : "text-muted-foreground")}>
            {t.lastSenderIsMe && "Anda: "}
            {t.lastMessageText || "—"}
          </span>
          {t.unread > 0 && (
            <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-brand-500 px-1 text-[9.5px] font-bold tabular-nums text-white">
              {t.unread > 99 ? "99+" : t.unread}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
