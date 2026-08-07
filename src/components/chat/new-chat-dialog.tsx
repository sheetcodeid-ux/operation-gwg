"use client";

import * as React from "react";
import { Check, Loader2, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { chatCreateGroupAction, chatStartDirectAction } from "@/lib/actions/chat";
import { cn } from "@/lib/utils";
import type { ChatPerson } from "@/lib/chat-shared";

/**
 * Mulai obrolan baru — japri dengan satu orang, atau grup dengan beberapa.
 *
 * Daftar orangnya adalah SELURUH pengguna aktif: seluruh perusahaan harus bisa
 * saling menghubungi tanpa admin memberi izin dulu.
 */
export function NewChatDialog({
  open,
  onOpenChange,
  people,
  onStarted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  people: ChatPerson[];
  onStarted: (threadId: string) => void;
}) {
  const [mode, setMode] = React.useState("dm");
  const [q, setQ] = React.useState("");
  const [picked, setPicked] = React.useState<string[]>([]);
  const [title, setTitle] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // Setiap kali dialog dibuka, mulai dari keadaan bersih — kalau tidak, pilihan
  // dari percakapan sebelumnya ikut terbawa.
  React.useEffect(() => {
    if (open) {
      setMode("dm");
      setQ("");
      setPicked([]);
      setTitle("");
    }
  }, [open]);

  const shown = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return people;
    // Cocokkan tiap kata pencarian ke nama / jabatan / departemen, supaya
    // "spv singkawang" tetap menemukan orangnya.
    const terms = term.split(/\s+/);
    return people.filter((p) => {
      const hay = `${p.name} ${p.jabatan ?? ""} ${p.department} ${p.roleLabel}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [people, q]);

  async function startDm(id: string) {
    setBusy(true);
    const res = await chatStartDirectAction(id);
    setBusy(false);
    if (res.error) return toast.error(res.error);
    if (res.threadId) {
      onStarted(res.threadId);
      onOpenChange(false);
    }
  }

  async function createGroup() {
    if (!title.trim()) return toast.error("Nama grup wajib diisi.");
    if (picked.length === 0) return toast.error("Pilih minimal satu anggota.");
    setBusy(true);
    const res = await chatCreateGroupAction({ title, memberIds: picked });
    setBusy(false);
    if (res.error) return toast.error(res.error);
    if (res.threadId) {
      onStarted(res.threadId);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        align="center"
        title="Mulai Percakapan"
        description="Terhubung ke seluruh pengguna — cari nama, jabatan, atau departemen."
        className="max-w-lg"
      >
        <div className="flex max-h-[70vh] flex-col p-5">
          <SegmentedTabs
            value={mode}
            onChange={(v) => setMode(v)}
            items={[
              { value: "dm", label: "Japri" },
              { value: "group", label: "Grup" },
            ]}
          />

          {mode === "group" && (
            <div className="mt-4">
              <Field label="Nama grup">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="mis. Koordinasi Promo Agustus" />
              </Field>
            </div>
          )}

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama, jabatan, atau departemen…"
              className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand-500"
            />
          </div>

          <div className="-mx-1 mt-3 min-h-0 flex-1 overflow-y-auto px-1">
            {shown.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Tidak ada yang cocok.</p>
            ) : (
              shown.map((p) => {
                const on = picked.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      mode === "dm"
                        ? void startDm(p.id)
                        : setPicked((cur) => (on ? cur.filter((x) => x !== p.id) : [...cur, p.id]))
                    }
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors",
                      on ? "bg-brand-500/10" : "hover:bg-muted/60",
                    )}
                  >
                    <Avatar name={p.name} src={p.avatarUrl} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {[p.jabatan, p.department].filter(Boolean).join(" · ") || p.roleLabel}
                      </p>
                    </div>
                    {mode === "group" && (
                      <span
                        className={cn(
                          "grid size-5 shrink-0 place-items-center rounded-md border",
                          on ? "border-brand-500 bg-brand-500 text-white" : "border-border",
                        )}
                      >
                        {on && <Check className="size-3.5" />}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {mode === "group" && (
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="size-4" />
                {picked.length} dipilih
              </p>
              <Button onClick={createGroup} disabled={busy || picked.length === 0 || !title.trim()}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null} Buat Grup
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
