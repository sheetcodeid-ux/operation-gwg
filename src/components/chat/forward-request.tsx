"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, MessagesSquare, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import { chatDirectoryAction, chatForwardRequestAction } from "@/lib/actions/chat";
import { cn } from "@/lib/utils";
import type { ChatPerson } from "@/lib/chat-shared";

/**
 * "Diskusikan" — teruskan sebuah pengajuan ke Pesan.
 *
 * Ini jalan pintas yang membuat obrolan berguna: dari kartu pengajuan langsung
 * ke percakapan yang sudah membawa pengajuannya, tanpa perlu menyalin judul
 * atau menjelaskan ulang pengajuan mana yang dimaksud. Memilih satu orang
 * membuka japri; memilih beberapa membuat grup pembahasan.
 */
export function DiscussButton({
  requestId,
  requestTitle,
  /** Saran tujuan — mis. PIC Creative yang mengerjakan design ini. */
  suggestedIds = [],
  label = "Diskusikan",
}: {
  requestId: string;
  requestTitle: string;
  suggestedIds?: string[];
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [people, setPeople] = React.useState<ChatPerson[] | null>(null);
  const [picked, setPicked] = React.useState<string[]>([]);
  const [note, setNote] = React.useState("");
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // Daftar orang diambil saat dialog PERTAMA dibuka, bukan saat halaman dirender:
  // kartu pengajuan bisa ada puluhan di satu halaman, dan tidak satu pun perlu
  // memuat direktori sebelum benar-benar dipakai.
  React.useEffect(() => {
    if (!open || people) return;
    let alive = true;
    void chatDirectoryAction().then((list) => {
      if (alive) setPeople(list);
    });
    return () => {
      alive = false;
    };
  }, [open, people]);

  React.useEffect(() => {
    if (open) {
      setPicked(suggestedIds.filter(Boolean));
      setNote("");
      setQ("");
    }
    // `suggestedIds` adalah array literal dari pemanggil; ikut jadi dependensi
    // akan memicu reset tiap render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const shown = React.useMemo(() => {
    const list = people ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return list;
    const terms = term.split(/\s+/);
    return list.filter((p) => {
      const hay = `${p.name} ${p.jabatan ?? ""} ${p.department} ${p.roleLabel}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [people, q]);

  async function submit() {
    if (picked.length === 0) return toast.error("Pilih dulu tujuannya.");
    setBusy(true);
    const res = await chatForwardRequestAction({ requestId, toUserIds: picked, note });
    setBusy(false);
    if (res.error) return toast.error(res.error);
    setOpen(false);
    toast.success("Pengajuan diteruskan ke Pesan");
    // Langsung dibawa ke percakapannya — meneruskan hampir selalu diikuti
    // menulis sesuatu di sana.
    if (res.threadId) router.push(`/pesan?t=${res.threadId}`);
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <MessagesSquare className="size-3.5" /> {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          align="center"
          title="Diskusikan Pengajuan"
          description={requestTitle}
          className="max-w-lg"
        >
          <div className="flex max-h-[72vh] flex-col p-5">
            <Field label="Catatan (opsional)">
              <Textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="mis. tolong revisi warna logonya, terlalu gelap"
              />
            </Field>

            <p className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Kirim ke
            </p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari nama, jabatan, atau departemen…"
                className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand-500"
              />
            </div>

            <div className="-mx-1 mt-2 min-h-0 flex-1 overflow-y-auto px-1">
              {people === null ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" />
                </div>
              ) : shown.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">Tidak ada yang cocok.</p>
              ) : (
                shown.map((p) => {
                  const on = picked.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPicked((cur) => (on ? cur.filter((x) => x !== p.id) : [...cur, p.id]))}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors",
                        on ? "bg-brand-500/10" : "hover:bg-muted/60",
                      )}
                    >
                      <Avatar name={p.name} src={p.avatarUrl} size={34} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {[p.jabatan, p.department].filter(Boolean).join(" · ") || p.roleLabel}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "grid size-5 shrink-0 place-items-center rounded-md border",
                          on ? "border-brand-500 bg-brand-500 text-white" : "border-border",
                        )}
                      >
                        {on && <Check className="size-3.5" />}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="size-4" />
                {picked.length > 1 ? `${picked.length} orang — dibuatkan grup` : `${picked.length} dipilih`}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                  Batal
                </Button>
                <Button onClick={submit} disabled={busy || picked.length === 0}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null} Kirim
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
