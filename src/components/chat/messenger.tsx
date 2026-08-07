"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessagesSquare } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  chatHideThreadAction,
  chatMarkAllReadAction,
  chatOpenAction,
  chatPollAction,
  chatSendAction,
  chatThreadsAction,
} from "@/lib/actions/chat";
import { uploadChatFiles } from "./upload";
import { DetailPanel } from "./detail-panel";
import { MessageThread } from "./message-thread";
import { NewChatDialog } from "./new-chat-dialog";
import { ThreadList } from "./thread-list";
import type { ChatMessage, ChatPerson, ChatThread } from "@/lib/chat-shared";

/**
 * Halaman Pesan — tiga kolom: daftar percakapan, isi obrolan, profil.
 *
 * Di layar lebar ketiganya terlihat sekaligus. Di layar kecil hanya SATU yang
 * tampil (daftar → obrolan lewat tombol kembali, profil lewat panel geser),
 * karena memampatkan tiga kolom ke lebar ponsel membuat semuanya tak terbaca.
 *
 * Pesan baru diambil dengan penyegaran berkala, bukan koneksi langsung: browser
 * di aplikasi ini tidak memegang kredensial database, jadi semua lalu lintas
 * tetap lewat server action. Penyegaran BERHENTI saat tab tidak terlihat supaya
 * tab yang ditinggal seharian tidak terus memanggil server.
 */
const POLL_MS = 6_000;

export function Messenger({
  meId,
  initialThreads,
  people,
}: {
  meId: string;
  initialThreads: ChatThread[];
  people: ChatPerson[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const { confirm, dialog } = useConfirm();

  const [threads, setThreads] = React.useState(initialThreads);
  const [activeId, setActiveId] = React.useState<string | null>(params.get("t"));
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [members, setMembers] = React.useState<ChatPerson[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [newOpen, setNewOpen] = React.useState(false);
  const [detailOpen, setDetailOpen] = React.useState(false);

  const active = threads.find((t) => t.id === activeId) ?? null;

  /** Buka percakapan: ambil isinya dan tandai sudah dibaca. */
  const open = React.useCallback(
    async (id: string) => {
      setActiveId(id);
      setLoading(true);
      const res = await chatOpenAction(id);
      setLoading(false);
      if (!res) {
        toast.error("Percakapan tidak tersedia.");
        setActiveId(null);
        return;
      }
      setMessages(res.messages);
      setMembers(res.people);
      // Lencana belum-dibaca dinolkan di layar begitu dibuka, tanpa menunggu
      // penyegaran berikutnya.
      setThreads((cur) => cur.map((t) => (t.id === id ? { ...t, unread: 0 } : t)));
    },
    [],
  );

  // Percakapan yang ditunjuk di URL (mis. setelah meneruskan pengajuan).
  const wanted = params.get("t");
  React.useEffect(() => {
    if (wanted && wanted !== activeId) void open(wanted);
    // `activeId` sengaja tidak jadi dependensi: efek ini hanya untuk menuruti URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, open]);

  /** Penyegaran berkala — daftar percakapan + isi yang sedang dibuka. */
  React.useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (stop || document.visibilityState !== "visible") return;
      const [list, msgs] = await Promise.all([
        chatThreadsAction(),
        activeId ? chatPollAction(activeId) : Promise.resolve(null),
      ]);
      if (stop) return;
      setThreads((cur) => {
        // Percakapan yang sedang dibuka tidak boleh mendadak "belum dibaca"
        // lagi — pengguna sedang menatapnya.
        const next = list.map((t) => (t.id === activeId ? { ...t, unread: 0 } : t));
        return sameThreads(cur, next) ? cur : next;
      });
      if (msgs) setMessages((cur) => (sameIds(cur, msgs) ? cur : msgs));
    };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      stop = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [activeId]);

  async function send(body: string, files: File[]): Promise<boolean> {
    if (!activeId) return false;
    setSending(true);
    try {
      const attachments = files.length > 0 ? await uploadChatFiles(files) : [];
      const res = await chatSendAction({ threadId: activeId, body, attachments });
      if (res.error) {
        toast.error(res.error);
        return false;
      }
      const fresh = await chatPollAction(activeId);
      if (fresh) setMessages(fresh);
      setThreads(await chatThreadsAction());
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim pesan.");
      return false;
    } finally {
      setSending(false);
    }
  }

  async function hide(id: string) {
    const t = threads.find((x) => x.id === id);
    const ok = await confirm({
      title: "Hapus percakapan ini?",
      description: `“${t?.title ?? "Percakapan"}” hilang dari daftar Anda. Lawan bicara tetap punya riwayatnya, dan percakapan muncul lagi kalau ada pesan baru.`,
      confirmLabel: "Hapus",
      tone: "danger",
    });
    if (!ok) return;
    const res = await chatHideThreadAction(id);
    if (res.error) return toast.error(res.error);
    setThreads((cur) => cur.filter((x) => x.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
    toast.success("Percakapan dihapus dari daftar Anda");
  }

  async function markAll() {
    await chatMarkAllReadAction();
    setThreads((cur) => cur.map((t) => ({ ...t, unread: 0 })));
    router.refresh();
  }

  return (
    <>
      {/* Tinggi dikunci ke layar supaya yang menggulir hanya daftar dan riwayat,
          bukan seluruh halaman — kotak tulis harus selalu terlihat. */}
      <div className="flex h-[calc(100dvh-13rem)] min-h-[26rem] overflow-hidden rounded-xl border border-border">
        <ThreadList
          threads={threads}
          activeId={activeId}
          onSelect={(id) => void open(id)}
          onNew={() => setNewOpen(true)}
          onHide={(id) => void hide(id)}
          onMarkAllRead={() => void markAll()}
          className={activeId ? "hidden w-full border-r lg:flex lg:w-80 xl:w-88" : "flex w-full lg:w-80 xl:w-88 lg:border-r"}
        />

        {active ? (
          <MessageThread
            thread={active}
            messages={messages}
            meId={meId}
            sending={sending}
            loading={loading}
            onSend={send}
            onBack={() => {
              setActiveId(null);
              setMessages([]);
            }}
            onOpenDetail={() => setDetailOpen(true)}
            className="flex min-w-0 flex-1"
          />
        ) : (
          <EmptyState className="hidden flex-1 lg:flex" />
        )}

        {active && <DetailPanel thread={active} people={members} className="hidden w-72 border-l xl:flex" />}
      </div>

      {/* Layar kecil: profil muncul sebagai panel geser, bukan kolom ketiga. */}
      {active && (
        <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
          <SheetContent title={active.kind === "group" ? "Anggota Grup" : "Profil"}>
            <DetailPanel thread={active} people={members} className="h-full border-0" />
          </SheetContent>
        </Sheet>
      )}

      <NewChatDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        people={people}
        onStarted={async (id) => {
          setThreads(await chatThreadsAction());
          void open(id);
        }}
      />
      {dialog}
    </>
  );
}

function EmptyState({ className }: { className?: string }) {
  return (
    <div className={`${className ?? ""} flex-col items-center justify-center gap-3 bg-background px-6 text-center`}>
      <span className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <MessagesSquare className="size-7" />
      </span>
      <p className="text-sm font-medium text-foreground">Pilih percakapan</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        Pilih dari daftar di kiri, atau tekan “Baru” untuk mulai mengobrol dengan siapa pun di perusahaan.
      </p>
    </div>
  );
}

/** Bandingkan ringkasan daftar — supaya penyegaran tidak merender ulang percuma. */
function sameThreads(a: ChatThread[], b: ChatThread[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((t, i) => {
    const o = b[i];
    return t.id === o.id && t.lastMessageAt === o.lastMessageAt && t.unread === o.unread && t.title === o.title;
  });
}

function sameIds(a: ChatMessage[], b: ChatMessage[]): boolean {
  return a.length === b.length && a.every((m, i) => m.id === b[i].id);
}
