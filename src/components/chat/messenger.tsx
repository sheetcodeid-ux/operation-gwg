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
import type { ChatMessage, ChatPerson, ChatThread, PickableRequest } from "@/lib/chat-shared";

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

/** Pesan sementara yang sudah tampil sebelum server memastikan tersimpan. */
interface Pending {
  id: string;
  threadId: string;
  body: string;
  ref: PickableRequest | null;
}

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
  const [members, setMembers] = React.useState<ChatPerson[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [newOpen, setNewOpen] = React.useState(false);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [pending, setPending] = React.useState<Pending[]>([]);

  /**
   * Riwayat yang sudah pernah dibuka, disimpan per percakapan.
   *
   * Inilah yang membuat berpindah dari satu orang ke orang lain terasa
   * seketika: percakapan yang pernah dibuka langsung tergambar dari sini, lalu
   * versi terbarunya menyusul di belakang layar. Tanpa ini, tiap klik berarti
   * menunggu perjalanan ke server dengan layar kosong.
   */
  const [cache, setCache] = React.useState<Record<string, ChatMessage[]>>({});
  const peopleCache = React.useRef<Record<string, ChatPerson[]>>({});

  const active = threads.find((t) => t.id === activeId) ?? null;
  const messages = activeId ? (cache[activeId] ?? []) : [];
  const activePending = pending.filter((p) => p.threadId === activeId);

  /** Buka percakapan: tampilkan yang tersimpan dulu, segarkan di belakang layar. */
  const open = React.useCallback(
    async (id: string) => {
      setActiveId(id);
      setMembers(peopleCache.current[id] ?? []);
      // Hanya tampilkan keadaan memuat kalau memang belum ada apa-apa untuk
      // digambar — kalau tidak, layar berkedip tiap kali berpindah.
      const known = cacheRef.current[id];
      setLoading(!known);
      // Lencana belum-dibaca dinolkan seketika, tanpa menunggu server.
      setThreads((cur) => cur.map((t) => (t.id === id ? { ...t, unread: 0 } : t)));

      const res = await chatOpenAction(id);
      if (!res) {
        setLoading(false);
        toast.error("Percakapan tidak tersedia.");
        return;
      }
      peopleCache.current[id] = res.people;
      setCache((cur) => ({ ...cur, [id]: res.messages }));
      // Jangan menimpa percakapan lain kalau pengguna sudah berpindah lagi
      // selagi permintaan ini berjalan.
      setActiveId((cur) => {
        if (cur === id) setMembers(res.people);
        return cur;
      });
      setLoading(false);
    },
    [],
  );

  // Cache dibaca di dalam `open` lewat ref supaya `open` tidak perlu dibuat
  // ulang setiap kali ada pesan baru masuk.
  const cacheRef = React.useRef(cache);
  React.useEffect(() => {
    cacheRef.current = cache;
  }, [cache]);

  // Percakapan yang ditunjuk di URL (mis. setelah meneruskan pengajuan).
  const wanted = params.get("t");
  React.useEffect(() => {
    if (wanted) void open(wanted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted]);

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
      if (msgs && activeId) {
        setCache((cur) => (sameIds(cur[activeId] ?? [], msgs) ? cur : { ...cur, [activeId]: msgs }));
      }
    };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      stop = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [activeId]);

  async function send(body: string, files: File[], ref: PickableRequest | null): Promise<boolean> {
    const id = activeId;
    if (!id) return false;

    // Pesan tanpa berkas langsung tampil sebagai gelembung sementara — menunggu
    // unggahan selesai baru menampilkannya membuat mengetik terasa lambat.
    const tempId = `tmp_${Date.now()}`;
    const optimistic = files.length === 0;
    if (optimistic) setPending((cur) => [...cur, { id: tempId, threadId: id, body, ref }]);

    setSending(true);
    try {
      const attachments = files.length > 0 ? await uploadChatFiles(files) : [];
      const res = await chatSendAction({ threadId: id, body, attachments, refRequestId: ref?.id ?? null });
      if (res.error) {
        toast.error(res.error);
        return false;
      }
      const [fresh, list] = await Promise.all([chatPollAction(id), chatThreadsAction()]);
      if (fresh) setCache((cur) => ({ ...cur, [id]: fresh }));
      setThreads(list.map((t) => (t.id === id ? { ...t, unread: 0 } : t)));
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim pesan.");
      return false;
    } finally {
      setPending((cur) => cur.filter((p) => p.id !== tempId));
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
    setCache((cur) => {
      const next = { ...cur };
      delete next[id];
      return next;
    });
    if (activeId === id) setActiveId(null);
    toast.success("Percakapan dihapus dari daftar Anda");
  }

  async function markAll() {
    await chatMarkAllReadAction();
    setThreads((cur) => cur.map((t) => ({ ...t, unread: 0 })));
    router.refresh();
  }

  return (
    <>
      {/* Mengisi area isi sepenuhnya; yang menggulir hanya daftar dan riwayat,
          sehingga kepala percakapan dan kotak tulis tidak pernah bergeser. */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ThreadList
          threads={threads}
          activeId={activeId}
          onSelect={(id) => void open(id)}
          onNew={() => setNewOpen(true)}
          onHide={(id) => void hide(id)}
          onMarkAllRead={() => void markAll()}
          className={cnPane(activeId !== null)}
        />

        {active ? (
          <MessageThread
            thread={active}
            messages={messages}
            meId={meId}
            sending={sending}
            loading={loading}
            pending={activePending.map((p) => ({ id: p.id, body: p.body, ref: p.ref }))}
            onSend={send}
            onBack={() => setActiveId(null)}
            onOpenDetail={() => setDetailOpen(true)}
            className="flex min-w-0 flex-1"
          />
        ) : (
          <EmptyState />
        )}

        {active && <DetailPanel thread={active} people={members} className="hidden w-80 shrink-0 border-l xl:flex" />}
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
          void open(id);
          setThreads(await chatThreadsAction());
        }}
      />
      {dialog}
    </>
  );
}

/** Kolom daftar: penuh di ponsel saat belum ada percakapan terbuka. */
function cnPane(hasActive: boolean): string {
  return hasActive
    ? "hidden w-full shrink-0 border-r lg:flex lg:w-80 xl:w-88"
    : "flex w-full shrink-0 lg:w-80 xl:w-88 lg:border-r";
}

function EmptyState() {
  return (
    <div className="hidden flex-1 flex-col items-center justify-center gap-3 bg-background px-6 text-center lg:flex">
      <span className="grid size-16 place-items-center rounded-3xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
        <MessagesSquare className="size-8" />
      </span>
      <p className="text-sm font-semibold text-foreground">Pilih percakapan</p>
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
