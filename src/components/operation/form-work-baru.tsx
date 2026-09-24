"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { MultiCombobox } from "@/components/ui/multi-combobox";
import { buatWorkAction } from "@/lib/actions/work-signal";
import type { PetaWorkAktif, WorkAktifSignal } from "@/lib/data/work-daftar";
import type { PilihanWork } from "@/lib/data/work-pilihan";

/**
 * SATU-SATUNYA FORM PEMBUATAN WORK.
 *
 * ┌─ DUA PINTU, SATU FORM ───────────────────────────────────────────────────┐
 * │                                                                          │
 * │   Command Center → /operational/work?buat=1&signal=10  → initialSignalIds│
 * │   /operational/work → Buat Work                        → tanpa preseleksi│
 * │                                                                          │
 * │ Keduanya berakhir di `buatWorkAction`, yang berakhir di `gwg_buat_work`. │
 * │ Tidak ada penulis kedua, tidak ada RPC kedua, tidak ada form kedua       │
 * │ (OD-STEP7-01 = C, OD-STEP7-04 = B).                                      │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ AKTOR BUKAN MEDAN FORM ─────────────────────────────────────────────────┐
 * │                                                                          │
 * │ `buatWorkAction` mengambil pelakunya dari `getSessionUser()`. Tidak ada  │
 * │ medan "oleh", "aktor", maupun "userId" di sini, dan tidak boleh ada:     │
 * │ nilai yang datang dari peramban tidak dapat dibuktikan siapa pun.        │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ PEMERIKSAAN DI SINI UNTUK KECEPATAN, BUKAN UNTUK KEAMANAN ──────────────┐
 * │                                                                          │
 * │ Judul kosong, Signal kosong, pelaksana kosong, dan owner yang merangkap  │
 * │ pelaksana seluruhnya ditolak juga oleh server action, lalu oleh          │
 * │ `gwg_buat_work`, lalu oleh trigger. Yang di sini hanya supaya orang      │
 * │ tahu sebelum menekan tombol — bukan supaya ia tidak bisa.                │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

/* ─────────────── bagian murni: dapat diuji tanpa merender apa pun ─────────────── */

/** Isi form, sebagaimana adanya di layar. */
export interface IsiForm {
  judul: string;
  deskripsi: string;
  owner: string;
  departemen: string;
  kategori: string;
  signalIds: string[];
  executorIds: string[];
}

/**
 * Apa yang masih kurang sebelum form boleh dikirim.
 *
 * MURNI dan diekspor — uji di repositori ini merender ke teks statis dan tidak
 * bisa mengetik maupun menekan tombol. Tanpa fungsi ini, aturan yang paling
 * penting di form ini tidak dapat diuji sama sekali.
 *
 * Seluruh butirnya ditolak juga oleh `buatWorkAction`, lalu `gwg_buat_work`,
 * lalu trigger. Yang di sini soal kecepatan umpan balik, bukan keamanan.
 */
export function kekuranganForm(m: IsiForm): string[] {
  const k: string[] = [];
  if (m.judul.trim() === "") k.push("Judul wajib diisi.");
  if (m.owner === "") k.push("Pemilik Work wajib dipilih.");
  if (m.departemen === "") k.push("Departemen utama wajib dipilih.");
  if (m.kategori === "") k.push("Kategori tenggat wajib dipilih.");
  if (m.signalIds.length === 0) k.push("Pilih sedikitnya satu Signal.");
  if (m.executorIds.length === 0) k.push("Pilih sedikitnya satu pelaksana.");
  if (m.owner !== "" && m.executorIds.includes(m.owner)) {
    k.push("Pemilik Work tidak boleh sekaligus menjadi pelaksananya.");
  }
  return k;
}

/**
 * Muatan yang dikirim ke `buatWorkAction`.
 *
 * MURNI dan diekspor supaya pemetaannya dapat diuji. Perhatikan apa yang TIDAK
 * ada di sini: pelaku. Ia diambil `buatWorkAction` dari sesi, dan tidak pernah
 * boleh datang dari peramban.
 */
export function muatanBuat(m: IsiForm) {
  return {
    judul: m.judul,
    deskripsi: m.deskripsi,
    ownerId: m.owner,
    departemen: m.departemen,
    tenggatKategori: m.kategori,
    signalIds: m.signalIds.map(Number),
    executorIds: m.executorIds,
  };
}

const KATEGORI = [
  { value: "urgent", label: "Urgent · 1 hari" },
  { value: "high", label: "High · 3 hari" },
  { value: "normal", label: "Normal · 5 hari" },
  { value: "low", label: "Low · 7 hari" },
];

/**
 * ┌─ PERINGATAN YANG TIDAK MELARANG APA PUN ─────────────────────────────────┐
 * │                                                                          │
 * │ D3 mengunci Signal ↔ Work sebagai N:N: satu Signal MEMANG boleh punya    │
 * │ beberapa Work. Yang ditampilkan di bawah karena itu keterangan, bukan    │
 * │ penghalang — tombolnya tidak dimatikan, tidak ada isian yang dikunci,    │
 * │ dan tidak ada satu kata pun yang menyatakan pembuatannya dilarang.       │
 * │                                                                          │
 * │ Yang diperbaiki cuma satu hal: sebelumnya orang TIDAK PUNYA CARA         │
 * │ mengetahui bahwa Signal yang dipegangnya sudah dikerjakan orang lain.    │
 * │ Keputusannya tetap miliknya; yang berubah, kini ia memutuskannya sambil  │
 * │ melihat.                                                                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
/**
 * MURNI dan diekspor — Work berjalan untuk sekumpulan Signal yang sedang dipilih.
 *
 * Tinggal DI SINI, bukan di `work-daftar.ts`: berkas itu `server-only`, dan
 * komponen ini berjalan di peramban. Yang diseberangkan cuma TIPE-nya, yang
 * memang hilang saat dikompilasi.
 */
export function workAktifTerpilih(
  signalIds: readonly string[],
  peta: PetaWorkAktif | undefined,
): WorkAktifSignal[] {
  if (!peta) return [];
  const terlihat = new Set<number>();
  const hasil: WorkAktifSignal[] = [];
  for (const id of signalIds) {
    for (const w of peta[id] ?? []) {
      // Satu Work bisa menangani beberapa Signal yang sedang dipilih sekaligus
      // — ia tetap SATU pekerjaan, dan tidak boleh disebut dua kali.
      if (terlihat.has(w.workId)) continue;
      terlihat.add(w.workId);
      hasil.push(w);
    }
  }
  return hasil.sort((a, b) => a.workId - b.workId);
}

export const PERINGATAN_WORK_AKTIF =
  "Signal ini sudah memiliki Work aktif. Periksa Work yang sudah ada sebelum membuat Work baru.";

const LABEL_STATUS_WORK: Record<string, string> = { open: "Terbuka", in_progress: "Dikerjakan" };

const waktuWib = (iso: string): string =>
  new Date(iso).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function FormWorkBaru({
  pilihan,
  initialSignalIds = [],
  workAktif,
}: {
  pilihan: PilihanWork;
  initialSignalIds?: number[];
  /** Work yang MASIH BERJALAN per Signal — dari `workAktifPerSignal()` di halaman. */
  workAktif?: PetaWorkAktif;
}) {
  const router = useRouter();
  const [judul, setJudul] = React.useState("");
  const [deskripsi, setDeskripsi] = React.useState("");
  const [owner, setOwner] = React.useState("");
  const [departemen, setDepartemen] = React.useState("");
  const [kategori, setKategori] = React.useState("");
  const [signalIds, setSignalIds] = React.useState<string[]>(initialSignalIds.map(String));
  const [executorIds, setExecutorIds] = React.useState<string[]>([]);
  const [sibuk, setSibuk] = React.useState(false);
  const [pesan, setPesan] = React.useState<string | null>(null);

  /* ── owner dan pelaksana saling meniadakan (D2 · I-03) ──
   *
   * Owner yang sudah dipilih hilang dari daftar pelaksana, dan orang yang
   * sudah menjadi pelaksana hilang dari daftar owner. Benturannya karena itu
   * tidak bisa dibuat, bukan cuma ditolak sesudahnya. */
  const opsiOwner = React.useMemo(
    () => pilihan.owner.filter((o) => !executorIds.includes(o.value)),
    [pilihan.owner, executorIds],
  );
  const opsiPelaksana = React.useMemo(
    () => pilihan.pelaksana.filter((o) => o.value !== owner),
    [pilihan.pelaksana, owner],
  );

  const opsiSignal = React.useMemo(
    () => pilihan.signal.map((s) => ({ value: String(s.id), label: s.label })),
    [pilihan.signal],
  );

  // Dihitung dari Signal yang SEDANG dipilih, bukan sekali saat halaman dibuka:
  // orang boleh menambah dan membuang Signal, dan keterangannya harus ikut.
  const berjalan = React.useMemo(() => workAktifTerpilih(signalIds, workAktif), [signalIds, workAktif]);

  const isi: IsiForm = { judul, deskripsi, owner, departemen, kategori, signalIds, executorIds };
  const kurang = React.useMemo(
    () => kekuranganForm({ judul, deskripsi, owner, departemen, kategori, signalIds, executorIds }),
    [judul, deskripsi, owner, departemen, kategori, signalIds, executorIds],
  );

  async function simpan() {
    if (kurang.length > 0) {
      setPesan(kurang[0]);
      return;
    }
    setSibuk(true);
    setPesan(null);
    const r = await buatWorkAction(muatanBuat(isi));
    setSibuk(false);
    if (!r.ok) {
      setPesan(r.pesan);
      return;
    }
    router.push(r.id ? `/operational/work/${r.id}` : "/operational/work");
  }

  return (
    <div className="w-full max-w-3xl space-y-4">
      {pesan && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{pesan}</div>}

      {berjalan.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">{PERINGATAN_WORK_AKTIF}</p>
          <ul className="mt-2 space-y-1">
            {berjalan.map((w) => (
              <li key={w.workId} className="text-xs">
                <span className="font-medium">#{w.workId}</span> {w.judul} ·{" "}
                {LABEL_STATUS_WORK[w.status] ?? w.status} · {w.ownerNama} · tenggat {waktuWib(w.tenggat)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border p-4 space-y-3">
        <label className="block text-sm">
          <span className="text-xs text-muted-foreground">Judul</span>
          <input
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={judul}
            onChange={(e) => setJudul(e.target.value)}
            placeholder="Apa yang akan dikerjakan"
          />
        </label>

        <label className="block text-sm">
          <span className="text-xs text-muted-foreground">Deskripsi</span>
          <textarea
            className="mt-1 w-full rounded-md border px-3 py-2"
            rows={3}
            value={deskripsi}
            onChange={(e) => setDeskripsi(e.target.value)}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-xs text-muted-foreground">Pemilik Work</span>
            <Combobox
              options={opsiOwner}
              value={owner}
              onChange={setOwner}
              placeholder="Pilih pemilik"
              searchable
              className="mt-1"
            />
          </label>

          <label className="block text-sm">
            <span className="text-xs text-muted-foreground">Departemen utama</span>
            <Combobox
              options={pilihan.departemen}
              value={departemen}
              onChange={setDepartemen}
              placeholder="Pilih departemen"
              searchable
              className="mt-1"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="text-xs text-muted-foreground">Kategori tenggat</span>
          <Combobox
            options={KATEGORI}
            value={kategori}
            onChange={setKategori}
            placeholder="Pilih kategori"
            className="mt-1"
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Tenggatnya dihitung dan disimpan basis data menurut kebijakan yang berlaku — layar ini tidak menghitungnya.
          </span>
        </label>

        <label className="block text-sm">
          <span className="text-xs text-muted-foreground">Signal yang ditangani</span>
          <MultiCombobox
            options={opsiSignal}
            value={signalIds}
            onChange={setSignalIds}
            placeholder="Pilih Signal"
            allLabel="Semua"
            className="mt-1"
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Work selalu berasal dari Signal. Sedikitnya satu wajib dipilih, dan kaitannya tidak menutup Signal itu.
          </span>
        </label>

        <label className="block text-sm">
          <span className="text-xs text-muted-foreground">Pelaksana</span>
          <MultiCombobox
            options={opsiPelaksana}
            value={executorIds}
            onChange={setExecutorIds}
            placeholder="Pilih pelaksana"
            allLabel="Semua"
            className="mt-1"
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Boleh lintas departemen. Departemen masing-masing dibekukan saat penugasan.
          </span>
        </label>
      </div>

      {kurang.length > 0 && (
        <ul className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          {kurang.map((k) => (
            <li key={k}>· {k}</li>
          ))}
        </ul>
      )}

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" disabled={sibuk} onClick={() => router.push("/operational/work")}>
          Batal
        </Button>
        <Button size="sm" disabled={sibuk || kurang.length > 0} onClick={simpan}>
          Buat Work
        </Button>
      </div>
    </div>
  );
}
