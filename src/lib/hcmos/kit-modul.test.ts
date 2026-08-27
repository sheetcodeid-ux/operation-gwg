import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const baca = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

/**
 * Kit modul HC-MOS — bentuk yang sama untuk semua halaman Human Capital.
 *
 * Struktur Organisasi dan Matriks RACI dinaikkan lebih dulu dan keduanya
 * berakhir pada bentuk yang sama. Menyalin bentuk itu halaman demi halaman
 * berarti menyalin juga setiap perbaikan kecilnya satu per satu — dan halaman
 * yang terlewat perlahan berbeda sendiri tanpa ada yang menyadarinya.
 *
 * Yang dikunci di sini perilakunya, bukan tampilannya.
 */

describe("perilaku yang dijanjikan bingkai modul", () => {
  const KIT = baca("src/components/hcmos/kit-modul.tsx");

  it("penghitung n/total hanya muncul saat memang sedang menyaring", () => {
    // Ditampilkan terus, ia cuma mengulang jumlah yang sudah tertulis di
    // ringkasan — dan pembacanya berhenti mempercayainya sebagai penanda.
    expect(KIT).toContain("{menyaring && hitung && (");
  });

  it("tombol bersihkan tahu kapan dirinya berguna", () => {
    expect(KIT).toContain("{menyaring && onBersihkan && (");
  });

  it("layar penuh mendengarkan perubahannya, bukan cuma menyalakannya", () => {
    // Tanpa ini, keluar lewat Esc menyisakan tombol yang masih berkata
    // "keluar layar penuh" padahal sudah keluar.
    expect(KIT).toContain('document.addEventListener("fullscreenchange"');
    expect(KIT).toContain('document.removeEventListener("fullscreenchange"');
  });

  it("batang legenda dibandingkan terhadap yang terbesar, bukan terhadap total", () => {
    // Terhadap total, kategori kecil jadi garis tak terlihat dan legendanya
    // berhenti menjawab "mana yang paling banyak, seberapa jauh jaraknya".
    expect(KIT).toContain("const puncak = Math.max(1, ...butir.map((b) => b.jumlah));");
  });

  it("bingkainya tetap punya tinggi di halaman yang bukan layar penuh", () => {
    expect(KIT).toContain("min-h-[70vh]");
    expect(KIT).toContain("[&:fullscreen]:h-screen");
  });
});

describe("Kontrak Tracker memakai bingkai itu", () => {
  const BOARD = baca("src/components/hcmos/kontrak-board.tsx");
  const HALAMAN = baca("src/app/(app)/hc-mos/kontrak/page.tsx");

  it("bingkai, batang alat, legenda, dan layar penuh terpasang", () => {
    for (const bagian of ["KerangkaModul", "BilahModul", "LegendaHitung", "useLayarPenuh"]) {
      expect(BOARD, bagian).toContain(bagian);
    }
  });

  it("hanya ada satu kotak pencarian di layar", () => {
    // Dua kotak cari yang menyaring hal berbeda, dan yang satu tidak
    // menghitung yang lain, adalah cara tercepat membuat orang salah baca.
    expect(BOARD).toContain("showSearch={false}");
    expect(BOARD).not.toContain('searchPlaceholder="Cari karyawan…"');
  });

  it("legenda status dihitung dari seluruh baris, bukan dari yang tampak", () => {
    // Dihitung dari yang tampak, menyorot satu status membuat tiga lainnya
    // jatuh ke nol — dan legendanya tidak bisa dipakai untuk kembali.
    const fn = BOARD.slice(BOARD.indexOf("const rekapStatus"), BOARD.indexOf("const bersihkan"));
    expect(fn).toContain("[kontrak, brand]");
    expect(fn).not.toContain("kontrakTersaring");
  });

  it("halamannya tidak lagi punya kepala halaman yang mengulang judul", () => {
    expect(HALAMAN).not.toContain("PageHeader");
    // Konteks pilarnya tetap ada — itu tidak dibawa batang alat modulnya.
    expect(HALAMAN).toContain("KonteksModul");
  });
});

describe("Rekrutmen memakai bingkai itu", () => {
  const BOARD = baca("src/components/hcmos/rekrutmen-board.tsx");

  it("bingkai, batang alat, legenda, dan layar penuh terpasang", () => {
    for (const bagian of ["KerangkaModul", "BilahModul", "LegendaHitung", "useLayarPenuh"]) {
      expect(BOARD, bagian).toContain(bagian);
    }
  });

  it("saringan tahap milik modul, bukan milik satu tab", () => {
    // Sebelumnya ia hidup di dalam tab Kandidat saja, jadi berpindah ke Jadwal
    // Interview membuangnya diam-diam — dan yang sedang menelusuri satu tahap
    // kehilangan tempatnya tanpa diberi tahu.
    const fn = BOARD.slice(BOARD.indexOf("export function RekrutmenBoard"), BOARD.indexOf("/* ───"));
    expect(fn).toContain("const [tahap, setTahap]");
    expect(fn).toContain("wawancaraTersaring");
    expect(fn).toContain("onboardingTersaring");
  });

  it("legenda tahap dihitung dari seluruh kandidat", () => {
    const fn = BOARD.slice(BOARD.indexOf("const rekapTahap"), BOARD.indexOf("const tampil ="));
    expect(fn).toContain("[kandidat]");
    expect(fn).not.toContain("kandidatTersaring");
  });

  it("tabelnya tidak lagi punya kotak carinya sendiri", () => {
    expect(BOARD).toContain("showSearch={false}");
    expect(BOARD).not.toContain('searchPlaceholder="Cari nama, posisi…"');
  });
});

describe("Compensation & Benefit memakai bingkai itu", () => {
  const BOARD = baca("src/components/hcmos/kompensasi-board.tsx");

  it("bingkai, batang alat, legenda, dan layar penuh terpasang", () => {
    for (const bagian of ["KerangkaModul", "BilahModul", "LegendaHitung", "useLayarPenuh"]) {
      expect(BOARD, bagian).toContain(bagian);
    }
  });

  it("kotak cari hanya muncul di tab yang barisnya punya nama orang", () => {
    // Payroll dan Struktur menampilkan agregat per brand dan per golongan.
    // Kotak cari yang tampil tapi tidak menyaring apa pun membuat yang
    // mengetik menyimpulkan datanya tidak ada — bukan bahwa tabelnya memang
    // bukan tentang orang.
    expect(BOARD).toContain('const bisaDicari = tab === "cuti" || tab === "bpjs";');
    expect(BOARD).toContain("cari={bisaDicari ? cari : undefined}");
    expect(BOARD).toContain("onCari={bisaDicari ? setCari : undefined}");
  });

  it("judulnya ikut menu yang membukanya, bukan nama modulnya saja", () => {
    // Satu modul melayani empat menu sidebar. Judul yang tetap membuat orang
    // merasa mendarat di tempat lain dari yang ia klik.
    expect(BOARD).toContain("const JUDUL_TAB");
    expect(BOARD).toContain('judul={JUDUL_TAB[tab] ?? "Compensation & Benefit"}');
  });

  it("pencariannya benar-benar dipakai kedua tabel itu", () => {
    expect(BOARD).toContain("baris={cutiTampil.slice(0, 12)");
    expect(BOARD).toContain("baris={belumTampil.map");
  });
});

describe("Kinerja, Intervensi, dan Kompetensi memakai bingkai itu", () => {
  const BOARD = baca("src/components/hcmos/kinerja-board.tsx");

  it("bingkai, batang alat, legenda, dan layar penuh terpasang", () => {
    for (const bagian of ["KerangkaModul", "BilahModul", "LegendaHitung", "useLayarPenuh"]) {
      expect(BOARD, bagian).toContain(bagian);
    }
  });

  it("judul dan panduan ikut tab, karena pengisinya memang berbeda", () => {
    // Penilaian diisi atasan langsung, Kompetensi hanya dibaca, Intervensi
    // diajukan siapa pun yang membawahi orangnya. Satu judul dan satu panduan
    // untuk ketiganya akan keliru untuk dua di antaranya.
    expect(BOARD).toContain("const JUDUL_TAB");
    expect(BOARD).toContain("const PANDUAN_TAB");
    expect(BOARD).toContain("panduan={PANDUAN_TAB[tab] ?? \"kinerja\"}");
  });

  it("pencarian berlaku di ketiga tab, tidak hilang saat berpindah", () => {
    expect(BOARD).toContain("penilaianTersaring");
    expect(BOARD).toContain("intervensiTersaring");
    expect(BOARD).toContain("kompetensiTersaring");
  });
});

describe("Case Management & Offboarding memakai bingkai itu", () => {
  const BOARD = baca("src/components/hcmos/modul-boards.tsx");
  const REKAMAN = baca("src/components/hcmos/rekaman.tsx");

  it("bingkai, batang alat, legenda, dan layar penuh terpasang", () => {
    const fn = BOARD.slice(BOARD.indexOf("export function RelasiBoard"), BOARD.indexOf("Fast Start, Fast Track"));
    for (const bagian of ["KerangkaModul", "BilahModul", "LegendaHitung", "useLayarPenuh"]) {
      expect(fn, bagian).toContain(bagian);
    }
  });

  it("saringannya berlaku di kedua tab", () => {
    // Perkara yang berujung resign muncul di dua tab sekaligus; saringan yang
    // hilang saat berpindah memaksa mengetik ulang nama yang sama.
    expect(BOARD).toContain("const kasusTampil");
    expect(BOARD).toContain("const keluarTampil");
    expect(BOARD).toContain("rows={kasusTampil}");
    expect(BOARD).toContain("rows={keluarTampil}");
  });

  it("tabel rekaman bisa mematikan kotak carinya sendiri", () => {
    expect(REKAMAN).toContain("showSearch = true");
    expect(REKAMAN).toContain("showSearch={showSearch}");
  });
});

describe("modul Learning & Development memakai bingkai itu", () => {
  const FAST = baca("src/components/hcmos/modul-boards.tsx");
  const LMS = baca("src/components/hcmos/modul-pelatihan-board.tsx");
  const TES = baca("src/components/hcmos/assessment-board.tsx");

  it("Fast Start & Fast Track: bingkai, legenda program, layar penuh", () => {
    const fn = FAST.slice(FAST.indexOf("export function FastTrackBoard"), FAST.indexOf("function rataRata"));
    for (const bagian of ["KerangkaModul", "BilahModul", "LegendaHitung", "useLayarPenuh"]) {
      expect(fn, bagian).toContain(bagian);
    }
    expect(fn).toContain("showSearch={false}");
  });

  it("Modul Pelatihan: legenda status modul bisa diklik", () => {
    for (const bagian of ["KerangkaModul", "BilahModul", "LegendaHitung", "useLayarPenuh"]) {
      expect(LMS, bagian).toContain(bagian);
    }
    expect(LMS).toContain("setSorotStatus");
  });

  it("Pre/Post Test sengaja TIDAK diberi kotak cari", () => {
    // Isinya sepuluh materi tetap. Kotak cari yang ada hanya karena modul lain
    // punya cuma menambah satu hal untuk diabaikan.
    expect(TES).toContain("KerangkaModul");
    expect(TES).toContain("BilahModul");
    expect(TES).not.toContain("onCari=");
  });
});

describe("Pusat Dokumen dan Database Karyawan memakai bingkai itu", () => {
  const DOK = baca("src/components/hcmos/dokumen-board.tsx");
  const KAR = baca("src/components/hcmos/karyawan-board.tsx");

  it("Pusat Dokumen: judulnya ikut jenis dokumen yang dibuka", () => {
    // Satu halaman melayani empat menu sidebar — SOP, Kebijakan, Culture,
    // Compliance. Judul yang tetap membuat orang merasa salah mendarat.
    expect(DOK).toContain("judul={JENIS_DOKUMEN_META[jenis].label}");
    for (const bagian of ["KerangkaModul", "BilahModul", "LegendaHitung", "useLayarPenuh"]) {
      expect(DOK, bagian).toContain(bagian);
    }
  });

  it("Pusat Dokumen: legenda status dihitung dari dokumen sejenis", () => {
    // Menyorot "arsip" tidak boleh membuat "aktif" jatuh ke nol.
    const mulai = DOK.indexOf("const rekapStatus");
    const fn = DOK.slice(mulai, DOK.indexOf("return (", mulai));
    expect(fn).toContain("sejenis.filter");
    expect(fn).not.toContain("tersaring.filter");
  });

  it("Database Karyawan: satu pencarian untuk kedua scope dan tabel keluar", () => {
    expect(KAR).toContain("manajemenTampil");
    expect(KAR).toContain("outletTampil");
    expect(KAR).toContain("keluarTampil");
    expect(KAR).not.toContain('searchPlaceholder="Cari nama, outlet…"');
  });
});
