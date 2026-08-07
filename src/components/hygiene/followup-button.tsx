"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Field, Textarea } from "@/components/ui/input";
import { hygieneRaiseFollowupAction, hygieneSupervisorAction } from "@/lib/actions/hygiene-followup";
import type { Attachment } from "@/lib/types";

/**
 * "Kirim ke SPV" — teruskan satu foto temuan untuk diperbaiki.
 *
 * Dipasang di setiap foto galeri audit. Yang dikirim adalah foto ITU SAJA
 * beserta nama areanya, karena "ada yang kotor di outlet X" tanpa menunjuk
 * bagian mana tidak bisa ditindaklanjuti.
 */
export function FollowupButton({
  hygieneId,
  outletId,
  photo,
  area,
}: {
  hygieneId: string;
  outletId: string;
  photo: Attachment;
  area: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [spv, setSpv] = React.useState<{ id: string; name: string } | null | undefined>(undefined);
  const [busy, setBusy] = React.useState(false);

  // Supervisornya dicari saat panel dibuka, bukan saat galeri dirender: satu
  // audit bisa punya 24 foto, dan tidak satu pun perlu tahu ini sebelum dipakai.
  React.useEffect(() => {
    if (!open || spv !== undefined) return;
    let alive = true;
    void hygieneSupervisorAction(outletId).then((s) => {
      if (alive) setSpv(s);
    });
    return () => {
      alive = false;
    };
  }, [open, outletId, spv]);

  async function submit() {
    if (!note.trim()) return toast.error("Tulis dulu apa yang perlu diperbaiki.");
    setBusy(true);
    const res = await hygieneRaiseFollowupAction({
      hygieneId,
      outletId,
      // `id` foto hygiene adalah path penyimpanannya (dengan awalan r2: bila di R2).
      photo: { path: photo.id, name: photo.name, type: "image/jpeg" },
      area,
      note,
    });
    setBusy(false);
    if (res.error) return toast.error(res.error);
    setOpen(false);
    setNote("");
    toast.success("Temuan dikirim ke supervisor");
    if (res.threadId) router.push(`/pesan?t=${res.threadId}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          // Galeri membuka foto besar saat diklik; tombol ini tidak boleh ikut.
          e.stopPropagation();
          setOpen(true);
        }}
        title="Kirim ke supervisor untuk diperbaiki"
        aria-label="Kirim temuan ke supervisor"
        className="absolute right-1.5 top-1.5 z-10 grid size-7 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-red-600"
      >
        <TriangleAlert className="size-3.5" />
      </button>

      <BottomSheet open={open} onOpenChange={setOpen} title="Kirim Temuan" description={area} className="sm:max-w-md">
        <div className="px-5 pb-6">
          <div className="flex justify-center overflow-hidden rounded-xl bg-muted/40 ring-1 ring-border">
            {/* object-contain: foto potret tidak dipangkas jadi landscape —
                bagian yang kotor justru sering ada di tepi atas atau bawah. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt={area} className="max-h-[45dvh] w-auto max-w-full object-contain" />
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            {spv === undefined ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="size-3 animate-spin" /> Mencari supervisor outlet…
              </span>
            ) : spv === null ? (
              <span className="text-red-600 dark:text-red-400">
                Outlet ini belum punya supervisor aktif — atur dulu di User Management.
              </span>
            ) : (
              <>
                Dikirim ke <span className="font-medium text-foreground">{spv.name}</span> lewat Pesan, dan tetap
                bertanda merah sampai ia menutupnya dengan foto bukti perbaikan.
              </>
            )}
          </p>

          <div className="mt-4">
            <Field label="Apa yang perlu diperbaiki?">
              <Textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="mis. lantai bawah rak masih berdebu, tolong dibersihkan hari ini"
              />
            </Field>
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={busy || !spv || !note.trim()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Kirim ke Supervisor
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
