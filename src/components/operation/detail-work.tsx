"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  kaitkanSignalWorkAction,
  kelolaPelaksanaWorkAction,
  lepasSignalWorkAction,
  ubahStatusWorkAction,
  ubahWorkAction,
} from "@/lib/actions/work-signal";
import type { DetailWork } from "@/lib/data/work-daftar";

/**
 * DETAIL WORK — DAN SEPULUH TINDAKAN YANG GERBANGNYA SUDAH DIKUNCI.
 *
 * ┌─ TOMBOL YANG DISEMBUNYIKAN BUKAN OTORISASI ──────────────────────────────┐
 * │                                                                          │
 * │ Yang memutuskan tetap `src/lib/actions/work-signal.ts` di server, dan    │
 * │ di bawahnya lagi trigger basis data. Yang di sini cuma menyembunyikan    │
 * │ tombol yang sudah pasti ditolak — supaya orang tidak menekan sesuatu     │
 * │ yang tidak akan pernah berhasil, bukan supaya ia tidak bisa.             │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WORK SELESAI ≠ SIGNAL SELESAI ──────────────────────────────────────────┐
 * │                                                                          │
 * │ I-08 memisahkan kedua lifecycle, dan layar ini tidak boleh menyatukannya │
 * │ kembali lewat kata-kata. Tidak ada satu label pun di sini yang menyebut  │
 * │ Signal "selesai", "ditutup", atau "beres" karena Work-nya selesai.       │
 * │ Yang ditampilkan keadaan SIGNAL apa adanya, dan keadaan KAITANNYA        │
 * │ sebagai hal yang terpisah.                                               │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ YANG SUDAH DILEPAS TETAP TAMPIL ────────────────────────────────────────┐
 * │                                                                          │
 * │ I-16, I-26, I-27, dan I-28 mengunci baris pelepasan sebagai rekam audit  │
 * │ permanen. Menyembunyikannya di layar membuat jejak itu tidak ada         │
 * │ gunanya. Tidak ada tombol "aktifkan kembali" untuk keduanya, di mana pun.│
 * └──────────────────────────────────────────────────────────────────────────┘
 */

const LABEL_STATUS: Record<string, string> = {
  open: "Terbuka",
  in_progress: "Dikerjakan",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

const waktuWib = (iso: string | null): string =>
  iso === null
    ? "—"
    : new Date(iso).toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

/** Tindakan yang menuntut isian sebelum dikirim. */
type Minta =
  | { jenis: "batal" }
  | { jenis: "owner" }
  | { jenis: "departemen" }
  | { jenis: "tenggat" }
  | { jenis: "lepas-signal"; signalId: number }
  | { jenis: "kait-signal" }
  | { jenis: "tambah-pelaksana" };

const JUDUL: Record<Minta["jenis"], string> = {
  batal: "Batalkan Work",
  owner: "Ganti owner",
  departemen: "Ganti departemen utama",
  tenggat: "Geser tenggat",
  "lepas-signal": "Lepas kaitan Signal",
  "kait-signal": "Kaitkan Signal",
  "tambah-pelaksana": "Tambah pelaksana",
};

/** Tindakan yang alasannya WAJIB — bukan pilihan tampilan, melainkan kontrak. */
const BERALASAN = new Set<Minta["jenis"]>(["batal", "owner", "departemen", "tenggat", "lepas-signal"]);

export function DetailWorkUI({
  detail,
  aktor,
  kelola,
  // Tanpa disebut, orang ini BUKAN pelaksana. Bawaan yang membuka lebih banyak
  // daripada yang diminta adalah bawaan yang salah.
  pelaksanaAktif = false,
}: {
  detail: DetailWork;
  aktor: string;
  kelola: boolean;
  pelaksanaAktif?: boolean;
}) {
  const router = useRouter();
  const [sibuk, setSibuk] = React.useState(false);
  const [pesan, setPesan] = React.useState<string | null>(null);
  const [minta, setMinta] = React.useState<Minta | null>(null);
  const [alasan, setAlasan] = React.useState("");
  const [nilai, setNilai] = React.useState("");

  const owner = aktor === detail.ownerId;
  const terminal = detail.terminal;

  // ── matriks yang sudah dikunci Step 3/4, dipakai apa adanya ──
  const bolehMulai = !terminal && detail.status === "open" && (owner || pelaksanaAktif || kelola);
  const bolehSelesai = !terminal && detail.status === "in_progress" && owner;
  const bolehBatal = !terminal && kelola;
  const bolehUbah = !terminal && kelola;
  const bolehPelaksana = !terminal && (owner || kelola);
  const bolehKait = !terminal && (owner || kelola);
  const bolehLepasSignal = !terminal && kelola;

  async function jalankan(fn: () => Promise<{ ok: true } | { ok: false; pesan: string }>) {
    setSibuk(true);
    setPesan(null);
    const r = await fn();
    setSibuk(false);
    if (!r.ok) {
      setPesan(r.pesan);
      return false;
    }
    setMinta(null);
    setAlasan("");
    setNilai("");
    router.refresh();
    return true;
  }

  async function kirim() {
    if (!minta) return;
    const a = alasan.trim();
    const v = nilai.trim();
    switch (minta.jenis) {
      case "batal":
        return jalankan(() => ubahStatusWorkAction(detail.id, "cancelled", a));
      case "owner":
        return jalankan(() => ubahWorkAction(detail.id, { ownerId: v, alasan: a }));
      case "departemen":
        return jalankan(() => ubahWorkAction(detail.id, { departemen: v, alasan: a }));
      case "tenggat":
        return jalankan(() => ubahWorkAction(detail.id, { tenggat: v, alasan: a }));
      case "lepas-signal":
        return jalankan(() => lepasSignalWorkAction(detail.id, minta.signalId, a));
      case "kait-signal":
        return jalankan(() => kaitkanSignalWorkAction(detail.id, Number(v)));
      case "tambah-pelaksana":
        return jalankan(() => kelolaPelaksanaWorkAction(detail.id, v, "tambah"));
    }
  }

  return (
    <div className="w-full space-y-4">
      {pesan && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{pesan}</div>}

      {/* ── kepala ── */}
      <div className="rounded-lg border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
            {LABEL_STATUS[detail.status] ?? detail.status}
          </span>
          {detail.overdue && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Lewat tenggat</span>
          )}
          {terminal && (
            <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700">
              Work sudah berhenti — tidak dapat diubah lagi
            </span>
          )}
        </div>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Owner</dt>
            <dd>{detail.ownerNama}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Departemen utama</dt>
            <dd>{detail.primaryDepartment}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Tenggat</dt>
            <dd>{waktuWib(detail.tenggat)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Dibuat</dt>
            <dd>
              {waktuWib(detail.dibuatPada)} · {detail.dibuatNama}
            </dd>
          </div>
        </dl>
        {detail.deskripsi.trim() !== "" && <p className="mt-3 whitespace-pre-wrap text-sm">{detail.deskripsi}</p>}

        {/* Snapshot perhitungan tenggat — dibaca apa adanya, tidak dihitung ulang. */}
        <div className="mt-3 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
          Kebijakan {detail.tenggatKebijakanVersi} · kategori {detail.tenggatKategori} · titik tolak{" "}
          {detail.tenggatAnchor} pada {waktuWib(detail.tenggatAnchorPada)} · zona {detail.tenggatZona} · dihitung{" "}
          {waktuWib(detail.tenggatDihitungPada)}
        </div>
      </div>

      {/* ── tindakan ── */}
      {terminal ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Work ini sudah {LABEL_STATUS[detail.status]?.toLowerCase()}. Seluruh perubahan berhenti di sini — pekerjaan
          lanjutan dibuat sebagai Work baru, bukan dengan membuka kembali yang ini.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {bolehMulai && (
            <Button size="sm" disabled={sibuk} onClick={() => jalankan(() => ubahStatusWorkAction(detail.id, "in_progress"))}>
              Mulai dikerjakan
            </Button>
          )}
          {bolehSelesai && (
            <Button size="sm" disabled={sibuk} onClick={() => jalankan(() => ubahStatusWorkAction(detail.id, "completed"))}>
              Nyatakan selesai
            </Button>
          )}
          {bolehBatal && (
            <Button size="sm" variant="outline" disabled={sibuk} onClick={() => setMinta({ jenis: "batal" })}>
              Batalkan
            </Button>
          )}
          {bolehUbah && (
            <>
              <Button size="sm" variant="outline" disabled={sibuk} onClick={() => setMinta({ jenis: "owner" })}>
                Ganti owner
              </Button>
              <Button size="sm" variant="outline" disabled={sibuk} onClick={() => setMinta({ jenis: "departemen" })}>
                Ganti departemen
              </Button>
              <Button size="sm" variant="outline" disabled={sibuk} onClick={() => setMinta({ jenis: "tenggat" })}>
                Geser tenggat
              </Button>
            </>
          )}
          {bolehKait && (
            <Button size="sm" variant="outline" disabled={sibuk} onClick={() => setMinta({ jenis: "kait-signal" })}>
              Kaitkan Signal
            </Button>
          )}
          {bolehPelaksana && (
            <Button size="sm" variant="outline" disabled={sibuk} onClick={() => setMinta({ jenis: "tambah-pelaksana" })}>
              Tambah pelaksana
            </Button>
          )}
        </div>
      )}

      {/* ── Signal ── */}
      <section className="rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Signal yang ditangani</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Keadaan Signal dan keadaan kaitannya dua hal yang berbeda. Work yang selesai tidak menutup Signal, dan Signal
          yang membaik tidak menutup Work.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {detail.signal.map((s) => (
            <li key={s.signalId} className={cn("rounded-md border p-3", !s.aktif && "bg-muted/40")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">#{s.signalId}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{s.severity}</span>
                <span className="text-xs text-muted-foreground">{s.kpiDefinitionId}</span>
                <span className="text-xs text-muted-foreground">
                  {s.cakupan} · {s.outletNama ?? "korporat"} · {s.periode}
                </span>
                <span className="text-xs text-muted-foreground">Signal: {s.statusSignal}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs",
                    s.aktif ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-700",
                  )}
                >
                  Kaitan {s.aktif ? "aktif" : "dilepas"}
                </span>
                {s.aktif && bolehLepasSignal && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={sibuk}
                    onClick={() => setMinta({ jenis: "lepas-signal", signalId: s.signalId })}
                  >
                    Lepas kaitan
                  </Button>
                )}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Dikaitkan {s.dikaitkanNama} · {waktuWib(s.dikaitkanPada)}
                {s.diakuiNama && ` · diakui ${s.diakuiNama} ${waktuWib(s.diakuiPada)}`}
              </div>
              {!s.aktif && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Dilepas {s.dilepasNama} · {waktuWib(s.dilepasPada)} · alasan: {s.alasan ?? "—"}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* ── pelaksana ── */}
      <section className="rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Pelaksana</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {detail.pelaksana.map((p) => (
            <li key={p.userId} className={cn("rounded-md border p-3", !p.aktif && "bg-muted/40")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{p.nama}</span>
                <span className="text-xs text-muted-foreground">{p.departemenSaatDitugaskan}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs",
                    p.aktif ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-700",
                  )}
                >
                  {p.aktif ? "aktif" : "dilepas"}
                </span>
                {p.aktif && bolehPelaksana && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={sibuk}
                    onClick={() => jalankan(() => kelolaPelaksanaWorkAction(detail.id, p.userId, "lepas"))}
                  >
                    Lepas
                  </Button>
                )}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Ditugaskan {p.ditugaskanNama} · {waktuWib(p.ditugaskanPada)}
                {!p.aktif && ` · dilepas ${p.dilepasNama} ${waktuWib(p.dilepasPada)}`}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ── riwayat ── */}
      <section className="rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Riwayat</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Catatan audit — hanya bertambah, tidak pernah diubah maupun dihapus.
        </p>
        {detail.riwayat.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Belum ada perubahan yang tercatat.</p>
        ) : (
          <ol className="mt-3 space-y-2 text-sm">
            {detail.riwayat.map((r) => (
              <li key={r.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{r.jenis}</span>
                  <span>
                    {r.nilaiLama ?? "—"} → {r.nilaiBaru}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {r.olehNama} · {waktuWib(r.pada)} · alasan: {r.alasan ?? "—"}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* ── isian tindakan ── */}
      <Dialog open={minta !== null} onOpenChange={(v) => !v && setMinta(null)}>
        <DialogContent title={minta ? JUDUL[minta.jenis] : ""}>
          <div className="space-y-3">
            {minta && minta.jenis !== "batal" && minta.jenis !== "lepas-signal" && (
              <label className="block text-sm">
                <span className="text-xs text-muted-foreground">
                  {minta.jenis === "owner" && "Id pengguna owner baru"}
                  {minta.jenis === "departemen" && "Nama departemen baru"}
                  {minta.jenis === "tenggat" && "Tenggat baru (ISO 8601)"}
                  {minta.jenis === "kait-signal" && "Id Signal"}
                  {minta.jenis === "tambah-pelaksana" && "Id pengguna pelaksana"}
                </span>
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2"
                  value={nilai}
                  onChange={(e) => setNilai(e.target.value)}
                />
              </label>
            )}
            {minta && BERALASAN.has(minta.jenis) && (
              <label className="block text-sm">
                <span className="text-xs text-muted-foreground">Alasan (wajib)</span>
                <textarea
                  className="mt-1 w-full rounded-md border px-3 py-2"
                  rows={3}
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                />
              </label>
            )}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setMinta(null)} disabled={sibuk}>
                Batal
              </Button>
              <Button
                size="sm"
                onClick={kirim}
                disabled={sibuk || (minta !== null && BERALASAN.has(minta.jenis) && alasan.trim() === "")}
              >
                Simpan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
