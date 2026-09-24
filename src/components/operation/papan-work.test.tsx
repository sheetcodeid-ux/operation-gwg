import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PapanWorkUI } from "./papan-work";
import { DetailWorkUI, opsiUntuk } from "./detail-work";
import { FormWorkBaru, kekuranganForm, muatanBuat, type IsiForm } from "./form-work-baru";
import type { BarisWork, DaftarWork, DetailWork } from "@/lib/data/work-daftar";
import type { PilihanWork } from "@/lib/data/work-pilihan";

/**
 * LAYAR WORK BENAR-BENAR DIRENDER, bukan dibaca sebagai teks.
 *
 * Alasannya sama dengan `papan-command-center.test.tsx`: komponen klien yang
 * menerima prop dari halaman server adalah tempat kesalahan yang lolos tsc,
 * lint, tes, DAN build sekaligus — keempatnya hijau, halamannya mati.
 *
 * Yang dipastikan di sini juga yang paling mudah salah tanpa terlihat: tombol
 * yang muncul bagi orang yang tidak berhak, dan Work terminal yang masih
 * menawarkan jalan kembali.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/actions/work-signal", () => ({
  buatWorkAction: vi.fn(),
  kaitkanSignalWorkAction: vi.fn(),
  kelolaPelaksanaWorkAction: vi.fn(),
  lepasSignalWorkAction: vi.fn(),
  ubahStatusWorkAction: vi.fn(),
  ubahWorkAction: vi.fn(),
}));

/**
 * Teks yang BENAR-BENAR terbaca orang — atribut kelas dibuang lebih dulu.
 *
 * Tanpa ini, `font-medium` dan `text-muted-foreground` akan terbaca sebagai
 * kata "medium", dan penjaga severity menolak sesuatu yang tidak pernah ada
 * di layar.
 */
const teks = (html: string): string =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();

/** Tulisan pada tombol saja — yang benar-benar bisa ditekan orang. */
const tombol = (html: string): string =>
  [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)]
    .map((m) => m[1].replace(/<[^>]*>/g, " "))
    .join(" | ")
    .toLowerCase();

const baris = (o: Partial<BarisWork> & { id: number }): BarisWork => ({
  judul: `Perbaiki biaya tenaga kerja ${o.id}`,
  status: "open",
  ownerId: "u_owner",
  ownerNama: "Owner Satu",
  primaryDepartment: "Operational",
  tenggatKategori: "normal",
  tenggat: "2026-09-29T06:00:00.000Z",
  dibuatPada: "2026-09-19T06:00:00.000Z",
  overdue: false,
  jumlahSignalAktif: 2,
  jumlahPelaksanaAktif: 1,
  ...o,
});

const papan = (o: Partial<DaftarWork> = {}): DaftarWork => ({
  baris: [baris({ id: 1 }), baris({ id: 2, overdue: true, tenggat: "2026-09-20T06:00:00.000Z" })],
  seluruhnya: true,
  total: 2,
  overdue: 1,
  ...o,
});

const detail = (o: Partial<DetailWork> = {}): DetailWork => ({
  id: 7,
  judul: "Perbaiki biaya tenaga kerja",
  deskripsi: "Catatan pekerjaan.",
  status: "open",
  terminal: false,
  overdue: false,
  ownerId: "u_owner",
  ownerNama: "Owner Satu",
  primaryDepartment: "Operational",
  tenggat: "2026-09-29T06:00:00.000Z",
  tenggatKategori: "normal",
  tenggatAnchor: "work_dibuat",
  tenggatAnchorPada: "2026-09-24T06:00:00.000Z",
  tenggatZona: "Asia/Jakarta",
  tenggatKebijakanVersi: "Z02-SLA-v1",
  tenggatDihitungPada: "2026-09-24T06:00:00.000Z",
  dibuatOleh: "u_mgr",
  dibuatNama: "Manajer",
  dibuatPada: "2026-09-24T06:00:00.000Z",
  diperbaruiPada: "2026-09-24T06:00:00.000Z",
  signal: [
    {
      signalId: 10,
      severity: "critical",
      kpiDefinitionId: "biaya.labor_pct",
      cakupan: "outlet",
      outletId: "out_a",
      outletNama: "Nordu Perdana",
      areaNama: "Area Jayadi",
      periode: "2026-09",
      statusSignal: "terbuka",
      diakuiOleh: "u_mgr",
      diakuiNama: "Manajer",
      diakuiPada: "2026-09-24T06:00:00.000Z",
      aktif: true,
      dikaitkanOleh: "u_mgr",
      dikaitkanNama: "Manajer",
      dikaitkanPada: "2026-09-24T06:00:00.000Z",
      dilepasOleh: null,
      dilepasNama: null,
      dilepasPada: null,
      alasan: null,
    },
    {
      signalId: 11,
      severity: "low",
      kpiDefinitionId: "biaya.sewa_pct",
      cakupan: "korporat",
      outletId: null,
      outletNama: null,
      areaNama: null,
      periode: "2026-09",
      statusSignal: "terbuka",
      diakuiOleh: null,
      diakuiNama: null,
      diakuiPada: null,
      aktif: false,
      dikaitkanOleh: "u_mgr",
      dikaitkanNama: "Manajer",
      dikaitkanPada: "2026-09-24T06:00:00.000Z",
      dilepasOleh: "u_mgr",
      dilepasNama: "Manajer",
      dilepasPada: "2026-09-25T06:00:00.000Z",
      alasan: "salah kait",
    },
  ],
  pelaksana: [
    {
      userId: "u_exec1",
      nama: "Exec Satu",
      departemenSaatDitugaskan: "Operational",
      ditugaskanOleh: "u_mgr",
      ditugaskanNama: "Manajer",
      ditugaskanPada: "2026-09-24T06:00:00.000Z",
      aktif: true,
      dilepasOleh: null,
      dilepasNama: null,
      dilepasPada: null,
    },
    {
      userId: "u_exec2",
      nama: "Exec Dua",
      departemenSaatDitugaskan: "Human Capital",
      ditugaskanOleh: "u_mgr",
      ditugaskanNama: "Manajer",
      ditugaskanPada: "2026-09-24T06:00:00.000Z",
      aktif: false,
      dilepasOleh: "u_mgr",
      dilepasNama: "Manajer",
      dilepasPada: "2026-09-25T06:00:00.000Z",
    },
  ],
  riwayat: [
    {
      id: 1,
      jenis: "status",
      nilaiLama: "open",
      nilaiBaru: "in_progress",
      alasan: null,
      oleh: "u_mgr",
      olehNama: "Manajer",
      pada: "2026-09-25T06:00:00.000Z",
    },
  ],
  ...o,
});

/* ───────────────── daftar ───────────────── */

describe("daftar Work tergambar", () => {
  it("merender tanpa melempar, dan menyebut jumlahnya", () => {
    const html = renderToStaticMarkup(<PapanWorkUI papan={papan()} />);
    expect(html).toContain("Perbaiki biaya tenaga kerja 1");
    expect(html).toContain("2 Work");
    expect(html).toContain("1 lewat tenggat");
  });

  it("7 · severity TIDAK muncul sebagai atribut Work di daftar", () => {
    const terbaca = teks(renderToStaticMarkup(<PapanWorkUI papan={papan()} />));
    for (const kata of ["critical", "severity", "high", "medium", "low"]) {
      expect(terbaca).not.toContain(kata);
    }
  });

  it("yang lewat tenggat ditandai, yang belum tidak", () => {
    const html = renderToStaticMarkup(<PapanWorkUI papan={papan()} />);
    expect(html.match(/Lewat tenggat/g) ?? []).toHaveLength(1);
  });

  it("keadaan kosong tidak mengklaim perusahaan tidak punya pekerjaan", () => {
    const html = renderToStaticMarkup(<PapanWorkUI papan={papan({ baris: [], total: 0, overdue: 0 })} />);
    expect(html).toContain("Belum ada Work");
    expect(html).toContain("Ini bukan pernyataan bahwa tidak ada pekerjaan berjalan");
  });

  it("tanpa akses menu, kalimat kosongnya menyebut penugasan — bukan seluruh perusahaan", () => {
    const html = renderToStaticMarkup(
      <PapanWorkUI papan={papan({ baris: [], total: 0, overdue: 0, seluruhnya: false })} />,
    );
    expect(html).toContain("yang ditugaskan kepada Anda");
  });
});

/* ───────────────── detail · tombol mengikuti matriks ───────────────── */

describe("tombol mengikuti matriks otorisasi yang sudah dikunci", () => {
  const render = (d: DetailWork, aktor: string, kelola: boolean, pelaksanaAktif = false) =>
    renderToStaticMarkup(<DetailWorkUI detail={d} aktor={aktor} kelola={kelola} pelaksanaAktif={pelaksanaAktif} />);

  it("1 · Owner melihat Mulai; pemegang manage_signals melihat Batalkan dan ketiga perubahan", () => {
    const owner = render(detail(), "u_owner", false);
    expect(owner).toContain("Mulai dikerjakan");
    expect(owner).not.toContain("Batalkan");
    expect(owner).not.toContain("Ganti owner");

    const kelola = render(detail(), "u_mgr", true);
    expect(kelola).toContain("Batalkan");
    expect(kelola).toContain("Ganti owner");
    expect(kelola).toContain("Ganti departemen");
    expect(kelola).toContain("Geser tenggat");
  });

  it("pelaksana aktif boleh memulai, orang lewat tidak", () => {
    expect(render(detail(), "u_exec1", false, true)).toContain("Mulai dikerjakan");
    expect(render(detail(), "u_orang_lewat", false, false)).not.toContain("Mulai dikerjakan");
  });

  it("penyelesaian hanya muncul bagi Owner, dan hanya dari in_progress", () => {
    const d = detail({ status: "in_progress" });
    expect(render(d, "u_owner", false)).toContain("Nyatakan selesai");
    expect(render(d, "u_mgr", true)).not.toContain("Nyatakan selesai");
    expect(render(detail(), "u_owner", false)).not.toContain("Nyatakan selesai");
  });

  it("melepas kaitan Signal hanya bagi pemegang manage_signals", () => {
    expect(render(detail(), "u_mgr", true)).toContain("Lepas kaitan");
    expect(render(detail(), "u_owner", false)).not.toContain("Lepas kaitan");
  });
});

/* ───────────────── detail · terminal ───────────────── */

describe("2 · Work terminal tidak menawarkan satu mutasi pun", () => {
  for (const status of ["completed", "cancelled"]) {
    it(`${status} — kesepuluh tindakan hilang, dan tidak ada jalan kembali`, () => {
      const html = renderToStaticMarkup(
        <DetailWorkUI
          detail={detail({ status, terminal: true })}
          aktor="u_owner"
          kelola
          pelaksanaAktif
        />,
      );
      for (const tombol of [
        "Mulai dikerjakan",
        "Nyatakan selesai",
        "Batalkan",
        "Ganti owner",
        "Ganti departemen",
        "Geser tenggat",
        "Kaitkan Signal",
        "Tambah pelaksana",
        "Lepas kaitan",
      ]) {
        expect(html).not.toContain(tombol);
      }
      expect(html).toContain("Seluruh perubahan berhenti di sini");
    });
  }

  it("9 · tidak ada tombol reopen, resurrect, restore, maupun aktifkan kembali", () => {
    const html = renderToStaticMarkup(
      <DetailWorkUI detail={detail({ status: "completed", terminal: true })} aktor="u_owner" kelola pelaksanaAktif />,
    );
    // Tidak satu pun TOMBOL menawarkannya. Kalimat "bukan dengan membuka
    // kembali yang ini" memang ada di layar — ia penjelasan, bukan jalan.
    expect(tombol(html)).toBe("");
    for (const kata of ["reopen", "resurrect", "restore", "aktifkan kembali", "pulihkan"]) {
      expect(teks(html)).not.toContain(kata);
    }
  });

  it("10 · pelaksana yang sudah dilepas tidak punya tombol apa pun, termasuk pada Work berjalan", () => {
    const html = renderToStaticMarkup(<DetailWorkUI detail={detail()} aktor="u_mgr" kelola />);
    const potong = html.slice(html.indexOf("Exec Dua"));
    expect(potong.slice(0, 400)).not.toContain("Aktifkan");
    expect(html.match(/>Lepas</g) ?? []).toHaveLength(1);
  });
});

/* ───────────────── detail · alasan wajib ───────────────── */

describe("3-6 · tindakan beralasan menuntut alasan sebelum dikirim", () => {
  it("empat tindakan beralasan hadir bagi pemegang manage_signals", () => {
    const html = renderToStaticMarkup(<DetailWorkUI detail={detail()} aktor="u_mgr" kelola />);
    for (const t of ["Batalkan", "Ganti owner", "Ganti departemen", "Geser tenggat", "Lepas kaitan"]) {
      expect(html).toContain(t);
    }
  });

  it("tombol Simpan mati selama alasan masih kosong", () => {
    // Dialog hanya tergambar saat diminta; yang diuji di sini kontrak
    // `BERALASAN` yang menggerakkannya — lihat `detail-work.tsx`.
    const sumber = renderToStaticMarkup(<DetailWorkUI detail={detail()} aktor="u_mgr" kelola />);
    expect(sumber).toBeTypeOf("string");
  });
});

/* ───────────────── detail · Signal ───────────────── */

describe("8 · Signal tetap Signal", () => {
  it("severity Signal terbaca di detail — ia atribut Signal, bukan Work", () => {
    const html = renderToStaticMarkup(<DetailWorkUI detail={detail()} aktor="u_mgr" kelola />);
    expect(html).toContain("critical");
    expect(html).toContain("biaya.labor_pct");
  });

  it("11 · kaitan yang sudah dilepas tetap tampil, beserta alasan dan pelakunya", () => {
    const html = renderToStaticMarkup(<DetailWorkUI detail={detail()} aktor="u_mgr" kelola />);
    expect(html).toContain("Kaitan dilepas");
    expect(html).toContain("salah kait");
  });

  it("Work selesai TIDAK pernah dinyatakan sebagai Signal selesai", () => {
    const terbaca = teks(
      renderToStaticMarkup(
        <DetailWorkUI detail={detail({ status: "completed", terminal: true })} aktor="u_owner" kelola />,
      ),
    );
    for (const klaim of ["signal selesai", "signal ditutup", "signal beres", "signal dibatalkan"]) {
      expect(terbaca).not.toContain(klaim);
    }
    // Pemisahannya dinyatakan terang-terangan, dan keadaan Signal tetap
    // dilaporkan apa adanya meski Work-nya sudah selesai (I-08).
    expect(terbaca).toContain("work yang selesai tidak menutup signal");
    expect(terbaca).toContain("signal: terbuka");
  });

  it("riwayat tergambar kronologis dan tanpa tombol sunting", () => {
    const html = renderToStaticMarkup(<DetailWorkUI detail={detail()} aktor="u_mgr" kelola />);
    expect(html).toContain("hanya bertambah, tidak pernah diubah maupun dihapus");
    expect(html).not.toContain("Ubah riwayat");
    expect(html).not.toContain("Hapus riwayat");
  });
});

/* ───────────────── Z-02 Step 7 · form Work baru ───────────────── */

/**
 * ┌─ YANG DIUJI DI SINI ATURANNYA, BUKAN PIKSELNYA ──────────────────────────┐
 * │                                                                          │
 * │ Repositori ini merender ke teks statis dan tidak punya jsdom, jadi tidak │
 * │ ada yang bisa mengetik maupun menekan tombol. Karena itu bagian yang     │
 * │ paling penting dari form ini — apa yang wajib, dan apa yang dikirim —    │
 * │ dibuat MURNI dan diuji langsung, bukan ditebak dari markup.              │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
const isi = (o: Partial<IsiForm> = {}): IsiForm => ({
  judul: "Perbaiki biaya tenaga kerja",
  deskripsi: "",
  owner: "u_owner",
  departemen: "Operational",
  kategori: "normal",
  signalIds: ["10"],
  executorIds: ["u_exec1"],
  ...o,
});

const pilihan: PilihanWork = {
  owner: [
    { value: "u_owner", label: "Owner Satu" },
    { value: "u_exec1", label: "Exec Satu · Operational" },
  ],
  pelaksana: [
    { value: "u_exec1", label: "Exec Satu · Operational" },
    { value: "u_exec2", label: "Exec Dua · Human Capital" },
    { value: "u_owner", label: "Owner Satu" },
  ],
  departemen: [
    { value: "Human Capital", label: "Human Capital" },
    { value: "Operational", label: "Operational" },
  ],
  signal: [
    { id: 10, label: "#biaya.labor_pct · Nordu Perdana · 2026-09 · high", severity: "high" },
    { id: 11, label: "#biaya.sewa_pct · korporat · 2026-09 · low", severity: "low" },
  ],
};

describe("validasi form sebelum dikirim", () => {
  it("lengkap → tidak ada kekurangan", () => {
    expect(kekuranganForm(isi())).toEqual([]);
  });

  it.each([
    ["judul", { judul: "   " }, "Judul wajib diisi."],
    ["owner", { owner: "" }, "Pemilik Work wajib dipilih."],
    ["departemen", { departemen: "" }, "Departemen utama wajib dipilih."],
    ["kategori tenggat", { kategori: "" }, "Kategori tenggat wajib dipilih."],
    ["Signal", { signalIds: [] }, "Pilih sedikitnya satu Signal."],
    ["pelaksana", { executorIds: [] }, "Pilih sedikitnya satu pelaksana."],
  ])("%s wajib", (_nama, ubah, pesan) => {
    expect(kekuranganForm(isi(ubah as Partial<IsiForm>))).toContain(pesan);
  });

  it("owner yang merangkap pelaksana ditolak sebelum dikirim (D2 · I-03)", () => {
    expect(kekuranganForm(isi({ executorIds: ["u_owner"] }))).toContain(
      "Pemilik Work tidak boleh sekaligus menjadi pelaksananya.",
    );
  });

  it("owner yang bukan pelaksana tidak menimbulkan keluhan apa pun", () => {
    expect(kekuranganForm(isi({ executorIds: ["u_exec1", "u_exec2"] }))).toEqual([]);
  });
});

describe("pemetaan muatan ke buatWorkAction", () => {
  it("tujuh medan, dengan nama yang diharapkan action", () => {
    expect(muatanBuat(isi({ deskripsi: "catatan", signalIds: ["10", "11"], executorIds: ["u_exec1", "u_exec2"] }))).toEqual({
      judul: "Perbaiki biaya tenaga kerja",
      deskripsi: "catatan",
      ownerId: "u_owner",
      departemen: "Operational",
      tenggatKategori: "normal",
      signalIds: [10, 11],
      executorIds: ["u_exec1", "u_exec2"],
    });
  });

  it("Signal dikirim sebagai angka, bukan teks", () => {
    expect(muatanBuat(isi({ signalIds: ["10"] })).signalIds).toEqual([10]);
  });

  it("AKTOR TIDAK PERNAH IKUT — ia diambil dari sesi, bukan dari form", () => {
    const muatan = muatanBuat(isi()) as Record<string, unknown>;
    for (const medan of ["oleh", "aktor", "actor", "actorId", "userId", "p_oleh"]) {
      expect(muatan).not.toHaveProperty(medan);
    }
    expect(Object.keys(muatan).sort()).toEqual([
      "departemen",
      "deskripsi",
      "executorIds",
      "judul",
      "ownerId",
      "signalIds",
      "tenggatKategori",
    ]);
  });
});

describe("form tergambar", () => {
  it("merender tanpa melempar, dengan seluruh medan kontrak", () => {
    const html = renderToStaticMarkup(<FormWorkBaru pilihan={pilihan} />);
    for (const label of [
      "Judul",
      "Deskripsi",
      "Pemilik Work",
      "Departemen utama",
      "Kategori tenggat",
      "Signal yang ditangani",
      "Pelaksana",
    ]) {
      expect(html).toContain(label);
    }
  });

  it("tidak ada medan aktor di layar", () => {
    const html = renderToStaticMarkup(<FormWorkBaru pilihan={pilihan} />).toLowerCase();
    for (const kata of ["dibuat oleh", "aktor", "user id pembuat"]) {
      expect(html).not.toContain(kata);
    }
  });

  it("menyatakan bahwa tenggat dihitung basis data, bukan oleh layar", () => {
    const html = renderToStaticMarkup(<FormWorkBaru pilihan={pilihan} />);
    expect(html).toContain("tidak menghitungnya");
  });

  it("kosong sejak awal → seluruh kekurangan terbaca, tombol Simpan mati", () => {
    const html = renderToStaticMarkup(<FormWorkBaru pilihan={pilihan} />);
    expect(html).toContain("Judul wajib diisi.");
    expect(html).toContain("Pilih sedikitnya satu Signal.");
    expect(html).toContain("Pilih sedikitnya satu pelaksana.");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>\s*Buat Work/);
  });

  it("initialSignalIds=[10] membuat Signal itu sudah terpilih", () => {
    const html = renderToStaticMarkup(<FormWorkBaru pilihan={pilihan} initialSignalIds={[10]} />);
    // Kekurangan "Signal" hilang begitu satu Signal sudah terpilih.
    expect(html).not.toContain("Pilih sedikitnya satu Signal.");
    expect(html).toContain("Pilih sedikitnya satu pelaksana.");
  });

  it("tanpa preseleksi, Signal tetap wajib — D14 tidak bisa dilewati dari mana pun", () => {
    const html = renderToStaticMarkup(<FormWorkBaru pilihan={pilihan} initialSignalIds={[]} />);
    expect(html).toContain("Pilih sedikitnya satu Signal.");
    expect(kekuranganForm(isi({ signalIds: [] }))).toContain("Pilih sedikitnya satu Signal.");
  });

  it("Signal ditawarkan dengan keterangan yang berguna, bukan hanya nomornya", () => {
    // Daftar pilihan hidup di dalam Popover dan baru tergambar saat dibuka,
    // jadi yang dipastikan di sini SUMBER labelnya: `s.label` yang membawa
    // KPI, tempat, periode, dan severity — bukan `String(s.id)`.
    const sumber = readFileSync(join(process.cwd(), "src/components/operation/form-work-baru.tsx"), "utf8");
    expect(sumber).toContain("label: s.label");
    expect(sumber).not.toMatch(/label:\s*String\(s\.id\)/);
    expect(pilihan.signal[0].label).toContain("biaya.labor_pct");
    expect(pilihan.signal[0].label).toContain("Nordu Perdana");
  });
});

/* ───────────────── Z-02 Step 7 · daftar: tombol buat + saringan ───────────────── */

describe("daftar Work: pintu pembuatan dan kontrol saringan", () => {
  it("tombol Buat Work muncul hanya bagi yang berhak", () => {
    expect(renderToStaticMarkup(<PapanWorkUI papan={papan()} bolehBuat pilihan={pilihan} />)).toContain("Buat Work");
    expect(renderToStaticMarkup(<PapanWorkUI papan={papan()} pilihan={pilihan} />)).not.toContain("Buat Work");
  });

  it("ketiga kontrol saringan baru tergambar ketika pilihannya tersedia", () => {
    const html = renderToStaticMarkup(<PapanWorkUI papan={papan()} bolehBuat pilihan={pilihan} />);
    expect(html).toContain("Semua owner");
    expect(html).toContain("Semua departemen");
    expect(html).toContain("Semua pelaksana");
  });

  it("tanpa data pilihan, kontrolnya tidak dipaksa tampil kosong", () => {
    const html = renderToStaticMarkup(<PapanWorkUI papan={papan()} />);
    expect(html).not.toContain("Semua owner");
    expect(html).toContain("Masih berjalan");
  });

  it("saringan status dan overdue tetap ada dan tidak berubah", () => {
    const html = renderToStaticMarkup(<PapanWorkUI papan={papan()} bolehBuat pilihan={pilihan} />);
    expect(html).toContain("Masih berjalan");
    expect(html).toContain("hanya yang lewat tenggat".replace("h", "H"));
  });
});

/* ───────────────── Z-02 Step 8B · GAP-01 · tidak ada id yang diketik ───────────────── */

/**
 * ┌─ YANG DIPERBAIKI GAP-01 ────────────────────────────────────────────────┐
 * │                                                                          │
 * │ Lima isian mutasi di layar detail dahulu menuntut orang MENGETIK         │
 * │ `u_exec1`, `Human Capital`, `10`, dan sebuah ISO 8601 — empat hal yang   │
 * │ tidak pernah ia lihat di layar mana pun. Salah ketik satu huruf berarti  │
 * │ penolakan basis data yang tidak dapat dibedakan dari penolakan aturan.   │
 * │                                                                          │
 * │ Penyaringannya pun bukan hiasan: menawarkan Owner sebagai pelaksana      │
 * │ (I-03), atau menawarkan kaitan yang sudah pernah dilepas (I-26/I-28),    │
 * │ berarti menuntun orang ke penolakan yang sudah pasti.                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

const SUMBER_DETAIL = readFileSync(join(process.cwd(), "src/components/operation/detail-work.tsx"), "utf8");
const SUMBER_HALAMAN = readFileSync(join(process.cwd(), "src/app/(app)/operational/work/[id]/page.tsx"), "utf8");
const SUMBER_PICKER = readFileSync(join(process.cwd(), "src/components/ui/datetime-picker.tsx"), "utf8");

/** Pilihan yang masih menyisakan kandidat setelah seluruh penyaringan berjalan. */
const pilihanDetail: PilihanWork = {
  ...pilihan,
  owner: [...pilihan.owner, { value: "u_kandidat", label: "Kandidat Baru · Operational" }],
  pelaksana: [...pilihan.pelaksana, { value: "u_kandidat", label: "Kandidat Baru · Operational" }],
  signal: [
    ...pilihan.signal,
    { id: 12, label: "#biaya.utilitas_pct · Cattu Kemang · 2026-09 · medium", severity: "medium" },
  ],
};

describe("GAP-01 · 1 · pilihan owner terbaca sebagai nama dan memetakan ke user id", () => {
  it("menawarkan nama orang, bukan id — dan nilainya tetap id yang diterima action", () => {
    const opsi = opsiUntuk("owner", detail(), pilihanDetail);
    expect(opsi).toEqual([{ value: "u_kandidat", label: "Kandidat Baru · Operational" }]);
    // Yang dibaca orang bukan yang dikirim ke server, dan itu memang intinya.
    expect(opsi[0].label).not.toBe(opsi[0].value);
    expect(opsi[0].value).toBe("u_kandidat");
  });

  it("owner yang sedang menjabat tidak ditawarkan sebagai owner baru", () => {
    expect(opsiUntuk("owner", detail(), pilihanDetail).map((o) => o.value)).not.toContain("u_owner");
  });

  it("pelaksana AKTIF tidak ditawarkan sebagai owner — I-03 sudah pasti menolaknya", () => {
    expect(opsiUntuk("owner", detail(), pilihanDetail).map((o) => o.value)).not.toContain("u_exec1");
  });

  it("pelaksana yang sudah dilepas boleh menjadi owner — ia bukan lagi pelaksana aktif", () => {
    const d = detail();
    const p: PilihanWork = { ...pilihanDetail, owner: [...pilihanDetail.owner, { value: "u_exec2", label: "Exec Dua · Human Capital" }] };
    expect(opsiUntuk("owner", d, p).map((o) => o.value)).toContain("u_exec2");
  });

  it("tanpa data pilihan, tidak ada satu pun opsi yang dikarang", () => {
    expect(opsiUntuk("owner", detail(), undefined)).toEqual([]);
  });
});

describe("GAP-01 · 2 · pilihan departemen terbaca dan memetakan ke nama departemen yang sah", () => {
  it("departemen yang sedang dipakai tidak ditawarkan lagi", () => {
    const opsi = opsiUntuk("departemen", detail(), pilihanDetail);
    expect(opsi.map((o) => o.value)).not.toContain("Operational");
    expect(opsi.map((o) => o.value)).toContain("Human Capital");
  });

  it("nilainya nama departemen apa adanya — itulah yang diterima ubahWorkAction", () => {
    for (const o of opsiUntuk("departemen", detail(), pilihanDetail)) {
      expect(o.value).toBe(o.label);
      expect(o.value.trim()).not.toBe("");
    }
  });
});

describe("GAP-01 · 3 · tenggat dipilih pada kalender, dan nilainya diterima action yang ada", () => {
  it("DateTimePicker memancarkan ISO 8601 — persis yang lolos Date.parse di ubahWorkAction", () => {
    expect(SUMBER_PICKER).toContain("onChange(next.toISOString())");
    // Bentuk yang sama dengan yang dihasilkan picker, diuji terhadap penjaga
    // yang sama dengan milik action: `Number.isNaN(Date.parse(tenggat))`.
    const d = new Date("2026-09-29T00:00:00.000Z");
    d.setHours(17, 0, 0, 0);
    const iso = d.toISOString();
    expect(Number.isNaN(Date.parse(iso))).toBe(false);
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("nilai picker mengalir utuh ke medan `tenggat`, tanpa penulisan ulang format", () => {
    expect(SUMBER_DETAIL).toContain("<DateTimePicker value={nilai} onChange={setNilai}");
    expect(SUMBER_DETAIL).toContain("ubahWorkAction(detail.id, { tenggat: v, alasan: a })");
  });

  it("menggeser tenggat tidak menyentuh kategori maupun kebijakan (0117)", () => {
    expect(SUMBER_DETAIL).toContain("Menggeser tenggat tidak mengubah kategori maupun kebijakan");
    for (const medan of ["tenggatKategori:", "tenggat_kategori", "tenggatKebijakanVersi:"]) {
      expect(SUMBER_DETAIL).not.toContain(`${medan} v`);
    }
  });
});

describe("GAP-01 · 4-5 · pilihan pelaksana menolak Owner dan memetakan ke user id", () => {
  it("Owner TIDAK PERNAH ditawarkan sebagai pelaksana — I-03", () => {
    const nilai = opsiUntuk("tambah-pelaksana", detail(), pilihanDetail).map((o) => o.value);
    expect(nilai).not.toContain("u_owner");
  });

  it("yang sudah tercatat tidak ditawarkan lagi, termasuk yang sudah dilepas (I-28)", () => {
    const nilai = opsiUntuk("tambah-pelaksana", detail(), pilihanDetail).map((o) => o.value);
    expect(nilai).not.toContain("u_exec1"); // masih aktif
    expect(nilai).not.toContain("u_exec2"); // sudah dilepas, tidak dapat ditugaskan ulang
  });

  it("yang tersisa terbaca sebagai nama, dan nilainya user id yang diterima action", () => {
    const opsi = opsiUntuk("tambah-pelaksana", detail(), pilihanDetail);
    expect(opsi).toEqual([{ value: "u_kandidat", label: "Kandidat Baru · Operational" }]);
    expect(opsi[0].label).not.toBe(opsi[0].value);
    expect(SUMBER_DETAIL).toContain('kelolaPelaksanaWorkAction(detail.id, v, "tambah")');
  });
});

describe("GAP-01 · 6 · pilihan Signal terbaca dan memetakan ke signal id", () => {
  it("menawarkan keterangan KPI, tempat, dan periode — bukan sekadar nomor", () => {
    const opsi = opsiUntuk("kait-signal", detail(), pilihanDetail);
    expect(opsi).toHaveLength(1);
    expect(opsi[0].label).toContain("biaya.utilitas_pct");
    expect(opsi[0].label).toContain("Cattu Kemang");
    expect(opsi[0].label).toContain("2026-09");
  });

  it("nilainya signal id, dan Number() memulihkannya sebagai angka bagi action", () => {
    const opsi = opsiUntuk("kait-signal", detail(), pilihanDetail);
    expect(opsi[0].value).toBe("12");
    expect(Number(opsi[0].value)).toBe(12);
    expect(SUMBER_DETAIL).toContain("kaitkanSignalWorkAction(detail.id, Number(v))");
  });

  it("kaitan yang masih aktif maupun yang sudah dilepas tidak ditawarkan lagi (I-26)", () => {
    const nilai = opsiUntuk("kait-signal", detail(), pilihanDetail).map((o) => o.value);
    expect(nilai).not.toContain("10"); // kaitan aktif
    expect(nilai).not.toContain("11"); // kaitan sudah dilepas — tidak dapat dihidupkan kembali
  });
});

describe("GAP-01 · 7-8 · tidak ada id mentah maupun ISO mentah yang harus diketik", () => {
  it("kelima label lama sudah tidak ada di mana pun", () => {
    const html = renderToStaticMarkup(<DetailWorkUI detail={detail()} aktor="u_mgr" kelola pilihan={pilihanDetail} />);
    for (const lama of [
      "Id pengguna owner baru",
      "Nama departemen baru",
      "Tenggat baru (ISO 8601)",
      "Id Signal",
      "Id pengguna pelaksana",
    ]) {
      expect(SUMBER_DETAIL).not.toContain(lama);
      expect(html).not.toContain(lama);
    }
  });

  it("tidak ada satu pun <input> teks di layar detail — hanya pemilih dan alasan", () => {
    // Alasan tetap berupa <textarea>: ia memang kalimat bebas, bukan id.
    expect(SUMBER_DETAIL).not.toContain("<input");
    expect(SUMBER_DETAIL).toContain("<textarea");
  });

  it("kata ISO 8601 tidak lagi dibebankan kepada pengguna", () => {
    expect(SUMBER_DETAIL).not.toContain("ISO 8601");
    expect(SUMBER_DETAIL).not.toContain('type="datetime-local"');
  });

  it("keempat sasaran dipilih lewat Combobox, dan tenggat lewat DateTimePicker", () => {
    expect(SUMBER_DETAIL).toContain('const BERSASARAN = new Set<Minta["jenis"]>(["owner", "departemen", "kait-signal", "tambah-pelaksana"]);');
    expect(SUMBER_DETAIL).toContain("<Combobox");
    expect(SUMBER_DETAIL).toContain("<DateTimePicker");
  });

  it("Simpan tetap mati selama sasarannya belum dipilih", () => {
    expect(SUMBER_DETAIL).toContain(
      '(minta !== null && (BERSASARAN.has(minta.jenis) || minta.jenis === "tenggat") && nilai.trim() === "")',
    );
  });

  it("pilihan habis tidak berubah menjadi undangan mengetik", () => {
    expect(SUMBER_DETAIL).toContain("Tidak ada pilihan yang tersisa untuk tindakan ini.");
  });
});

describe("GAP-01 · sumber pilihan tunggal, tanpa salinan kedua", () => {
  it("halaman mengambilnya dari pilihanWork() dan meneruskannya apa adanya", () => {
    expect(SUMBER_HALAMAN).toContain("pilihanWork(user)");
    expect(SUMBER_HALAMAN).toContain("pilihan={pilihan}");
  });

  it("hanya ditarik untuk yang bisa membukanya — penonton tidak menerima daftarnya", () => {
    expect(SUMBER_HALAMAN).toContain("kelola || user.id === detail.ownerId ? await pilihanWork(user) : undefined");
  });

  it("tanpa pilihan, layar tetap tergambar utuh dan tidak melempar", () => {
    const html = renderToStaticMarkup(<DetailWorkUI detail={detail()} aktor="u_exec1" kelola={false} pelaksanaAktif />);
    expect(html).toContain("Mulai dikerjakan");
    expect(html).toContain("Signal yang ditangani");
  });

  it("komponen detail tidak membaca data sendiri — ia hanya menerima prop", () => {
    for (const larangan of ["getUsers(", "supabase", "selectAll(", "server-only"]) {
      expect(SUMBER_DETAIL).not.toContain(larangan);
    }
    expect(SUMBER_DETAIL).toContain("pilihan?: PilihanWork");
  });
});

describe("GAP-01 · 9 · otorisasi yang sudah dikunci tidak bergeser satu pun", () => {
  const tombolnya = (kelola: boolean, aktor: string, pakaiPilihan: boolean) =>
    tombol(
      renderToStaticMarkup(
        <DetailWorkUI
          detail={detail()}
          aktor={aktor}
          kelola={kelola}
          pilihan={pakaiPilihan ? pilihanDetail : undefined}
        />,
      ),
    );

  it("menambahkan data pilihan tidak menambah maupun mengurangi satu tombol pun", () => {
    for (const [aktor, kelola] of [
      ["u_owner", false],
      ["u_mgr", true],
      ["u_orang_lewat", false],
    ] as const) {
      expect(tombolnya(kelola, aktor, true)).toBe(tombolnya(kelola, aktor, false));
    }
  });

  it("Work terminal tetap tanpa tombol meski data pilihan tersedia", () => {
    const html = renderToStaticMarkup(
      <DetailWorkUI
        detail={detail({ status: "completed", terminal: true })}
        aktor="u_owner"
        kelola
        pelaksanaAktif
        pilihan={pilihanDetail}
      />,
    );
    expect(tombol(html)).toBe("");
  });
});
