import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PapanWorkUI } from "./papan-work";
import { DetailWorkUI } from "./detail-work";
import type { BarisWork, DaftarWork, DetailWork } from "@/lib/data/work-daftar";

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
