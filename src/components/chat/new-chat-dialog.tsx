"use client";

import * as React from "react";
import { Check, Loader2, MessageSquarePlus, Search, Users, X } from "lucide-react";
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
 * Daftar orangnya SELURUH pengguna aktif, dikelompokkan per departemen. Dengan
 * ratusan akun, daftar rata satu kolom membuat orang harus menggulir jauh untuk
 * menemukan rekan satu timnya; pengelompokan membuat strukturnya kelihatan.
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

  // Tiap kali dibuka, mulai dari keadaan bersih — kalau tidak, pilihan dari
  // percakapan sebelumnya ikut terbawa.
  React.useEffect(() => {
    if (open) {
      setMode("dm");
      setQ("");
      setPicked([]);
      setTitle("");
    }
  }, [open]);

  const byId = React.useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  /** Hasil pencarian, dikelompokkan per departemen dan diurutkan. */
  const groups = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    const terms = term ? term.split(/\s+/) : [];
    const matched = people.filter((p) => {
      if (terms.length === 0) return true;
      const hay = `${p.name} ${p.jabatan ?? ""} ${p.department} ${p.roleLabel}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });

    const map = new Map<string, ChatPerson[]>();
    for (const p of matched) {
      const key = p.department || "Tanpa Departemen";
      const list = map.get(key);
      if (list) list.push(p);
      else map.set(key, [p]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "id"));
  }, [people, q]);

  const total = groups.reduce((n, [, list]) => n + list.length, 0);

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
        <div className="flex max-h-[74vh] flex-col p-5">
          <SegmentedTabs
            value={mode}
            onChange={setMode}
            items={[
              { value: "dm", label: "Japri", icon: MessageSquarePlus },
              { value: "group", label: "Grup", icon: Users },
            ]}
          />

          {mode === "group" && (
            <div className="mt-4">
              <Field label="Nama grup">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="mis. Koordinasi Promo Agustus"
                />
              </Field>
            </div>
          )}

          {/* Yang sudah dipilih tampil sebagai chip — dengan puluhan nama,
              menggulir balik hanya untuk memastikan siapa saja itu melelahkan. */}
          {mode === "group" && picked.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {picked.map((id) => {
                const p = byId.get(id);
                if (!p) return null;
                return (
                  <span
                    key={id}
                    className="flex items-center gap-1.5 rounded-full border border-border bg-muted/50 py-0.5 pl-0.5 pr-1.5 text-[11px]"
                  >
                    <Avatar name={p.name} src={p.avatarUrl} size={20} />
                    <span className="max-w-28 truncate text-foreground">{p.name}</span>
                    <button
                      type="button"
                      onClick={() => setPicked((cur) => cur.filter((x) => x !== id))}
                      className="grid size-4 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                      aria-label={`Buang ${p.name}`}
                    >
                      <X className="size-2.5" />
                    </button>
                  </span>
                );
              })}
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
            {total === 0 ? (
              <p className="py-10 text-center text-xs text-muted-foreground">Tidak ada yang cocok.</p>
            ) : (
              groups.map(([dept, list]) => (
                <div key={dept} className="mb-2">
                  {/* Kepala departemen tetap terlihat saat menggulir daftarnya. */}
                  <p className="sticky top-0 z-10 bg-card/95 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                    {dept} · {list.length}
                  </p>
                  {list.map((p) => {
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
                          "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors disabled:opacity-60",
                          on ? "bg-brand-500/10" : "hover:bg-muted/60",
                        )}
                      >
                        <Avatar name={p.name} src={p.avatarUrl} size={36} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{p.jabatan || p.roleLabel}</p>
                        </div>
                        {mode === "group" ? (
                          <span
                            className={cn(
                              "grid size-5 shrink-0 place-items-center rounded-md border",
                              on ? "border-brand-500 bg-brand-500 text-white" : "border-border",
                            )}
                          >
                            {on && <Check className="size-3.5" />}
                          </span>
                        ) : (
                          <MessageSquarePlus className="size-4 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {mode === "group" && (
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="size-4" />
                {picked.length} anggota dipilih
              </p>
              <Button onClick={createGroup} disabled={busy || picked.length === 0 || !title.trim()}>
                {busy && <Loader2 className="size-4 animate-spin" />} Buat Grup
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
