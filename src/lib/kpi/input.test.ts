import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { INDIKATOR } from "./indikator";
import { POSISI } from "./struktur";

/**
 * Pengisian angka KPI.
 *
 * Sebelumnya tidak ada sama sekali: halamannya menampilkan target dan capaian
 * tapi tidak pernah menjelaskan di mana angkanya diisi. Yang membukanya melihat
 * "Total Event / Program, target 30, actual 0" dan tidak punya satu pun tombol
 * untuk menambah event.
 *
 * Yang dijaga di sini: setiap indikator punya jalan masuk, dan setiap penulisan
 * dijaga di server — bukan cuma tombolnya disembunyikan di layar.
 */

const aksi = readFileSync(join(process.cwd(), "src/lib/actions/kpi.ts"), "utf8");
const dialog = readFileSync(join(process.cwd(), "src/components/kpi/dialog-input.tsx"), "utf8");
const papan = readFileSync(join(process.cwd(), "src/components/kpi/papan-kpi.tsx"), "utf8");
const tabel = readFileSync(join(process.cwd(), "src/components/kpi/form-tabel.tsx"), "utf8");

describe("setiap indikator punya jalan masuk", () => {
  it("tidak ada indikator yang tak bisa diisi maupun dihitung", () => {
    // Indikator yang bukan otomatis dan tidak punya bentuk isian adalah kolom
    // yang selamanya kosong — dan tidak ada yang bisa dilakukan pemakainya.
    const dikenal = new Set(["manual", "manual_brand", "entri", "pengurang", "lulus", "otomatis"]);
    for (const [posisi, daftar] of Object.entries(INDIKATOR)) {
      for (const i of daftar) {
        expect(dikenal.has(i.actual.sumber), `${posisi}/${i.key}: ${i.actual.sumber}`).toBe(true);
      }
    }
  });

  it("setiap bentuk isian punya formnya di layar", () => {
    for (const bentuk of ["angka", "brand", "kegiatan", "temuan", "tenggat", "efisiensi", "fee", "pasar"]) {
      expect(dialog, `bentuk ${bentuk} tanpa form`).toContain(`bentuk === "${bentuk}"`);
    }
  });

  it("indikator otomatis tidak ditawarkan untuk diisi tangan", () => {
    // Mengisi tangan angka yang dihitung otomatis akan menimpa hitungannya
    // tanpa jejak — dan tidak akan ada yang tahu angkanya sudah dikarang.
    expect(dialog).toContain('bentukIsian(i) !== "otomatis"');
  });

  it("tombol Input ada di halamannya, bukan di menu lain", () => {
    expect(papan).toContain("<DialogInput");
    expect(papan).toContain("<DialogPengaturan");
  });

  it("bulan dan tahun dipilih terpisah, bukan satu kotak '2026-09'", () => {
    expect(papan).toContain("tahunPilihan()");
    expect(papan).toContain("options={BULAN}");
    expect(dialog).toContain('label="Tahun"');
    expect(dialog).toContain('label="Bulan"');
  });
});

describe("penulisan dijaga di server", () => {
  it("tiga penjaga: hak akses, indikator milik posisi itu, dan bulan belum dikunci", () => {
    expect(aksi).toContain("canReachMenu(user, menu as MenuKey)");
    expect(aksi).toContain("punyaIndikator(");
    expect(aksi).toContain("periodeDikunci(periode, posisi, pic)");
  });

  it("setiap aksi tulis melewati gerbang yang sama", () => {
    // Satu aksi yang lupa memanggilnya sudah cukup untuk membuka seluruh
    // penjagaan — dan yang terlewat biasanya aksi yang ditambahkan paling akhir.
    const nama = aksi.match(/export async function (\w+Action)/g) ?? [];
    expect(nama.length).toBeGreaterThan(5);
    for (const n of nama) {
      const fn = n.replace("export async function ", "");
      const blok = aksi.slice(aksi.indexOf(`export async function ${fn}`));
      const badan = blok.slice(0, blok.indexOf("\nexport async function", 1));
      // Dua aksi punya gerbangnya sendiri, dan keduanya disebut di sini supaya
      // pengecualian tidak pernah diam-diam bertambah:
      //  • pengaturan bobot — hanya super admin;
      //  • unggah bukti — tidak menyentuh bulan atau posisi mana pun, jadi yang
      //    diperiksa hak membuka menunya, bukan penguncian bulannya.
      const sendiri: Record<string, string> = {
        simpanPengaturanAction: "bolehAturKpi(user)",
        uploadKpiBuktiAction: 'canReachMenu(user, "kpi_op_ca" as MenuKey)',
      };
      const lewat = sendiri[fn] ? badan.includes(sendiri[fn]) : badan.includes("await gerbang(");
      expect(lewat, `${fn} tidak melewati penjagaan`).toBe(true);
    }
  });

  it("tanggal di luar bulan yang diisi ditolak", () => {
    // Salah ketik tahun akan diam-diam menambah angka ke bulan yang sudah
    // ditutup, dan laporan yang sudah dibagikan berubah tanpa ada yang tahu.
    expect(aksi).toContain('input.tanggal.slice(0, 7) !== input.periode');
  });

  it("posisi yang dinilai per orang wajib menyebut orangnya, dan namanya harus terdaftar", () => {
    // Tanpa ini, satu salah ketik menyimpan angka ke "orang" yang tidak pernah
    // ada — dan capaiannya hilang tanpa jejak.
    expect(aksi).toContain("if (!pic) return { error: \"Pilih dulu PIC-nya.\" }");
    expect(aksi).toContain("p.pic.includes(pic)");
    // Posisi yang daftar PIC-nya datang dari basis data diperiksa ke daftar
    // itu. Memeriksanya ke daftar di berkas berarti satu-satunya PIC yang
    // diterima adalah daftar kosong, dan tidak ada angka yang bisa disimpan.
    expect(aksi).toContain("picDinamis(p.kode).some((o) => o.value === pic)");
    // Sebaliknya juga dijaga: posisi satu tim tidak boleh dipecah per orang.
    expect(aksi).toContain("Posisi ini dinilai sebagai satu tim, bukan per orang.");
  });

  it("bobot di luar 0–100 ditolak", () => {
    expect(aksi).toContain("u.bobot < 0 || u.bobot > 100");
  });

  it("hanya super admin yang boleh mengubah bobot", () => {
    // Kalau orang yang dinilai bisa mengubah bobotnya sendiri, angkanya
    // berhenti berarti apa pun.
    expect(aksi).toContain("Hanya super admin yang boleh mengubah bobot dan target.");
  });
});

describe("angka yang tersimpan bisa ditelusuri dan dibatalkan", () => {
  it("ada riwayat input yang bisa dibaca dan barisnya bisa dihapus", () => {
    // Tanpa riwayat, satu salah ketik tidak punya jalan perbaikan selain
    // menghubungi orang yang bisa membuka basis datanya.
    expect(papan).toContain("function TabelRiwayat");
    expect(papan).toContain("hapusEntriAction");
  });

  it("setiap posisi punya tenggat yang jelas untuk indikator penyampaian data", () => {
    const perluTenggat = POSISI.filter((p) =>
      INDIKATOR[p.kode].some((i) => (i.actual.sumber === "pengurang" || i.actual.sumber === "lulus") && i.actual.entri === "penyampaian"),
    );
    const indikatorTs = readFileSync(join(process.cwd(), "src/lib/kpi/indikator.ts"), "utf8");
    for (const p of perluTenggat) {
      expect(indikatorTs, `${p.nama} tanpa tenggat`).toContain(`${p.kode}: [`);
    }
  });
});

describe("isian yang berulang dikerjakan sekali lewat tabel", () => {
  it("kegiatan diisi banyak baris sekaligus, bukan satu per satu", () => {
    // Tiga puluh event sebulan lewat dialog satuan berarti tiga puluh kali
    // buka-isi-simpan — dan yang benar-benar terjadi bukan tiga puluh baris
    // tercatat, melainkan sepuluh baris lalu ditinggalkan.
    expect(tabel).toContain("export function FormKegiatan");
    expect(tabel).toContain("simpanEntriMassalAction");
    expect(papan).toContain("<FormKegiatan");
  });

  it("tanggalnya dipilih lewat pemilih tanggal aplikasi, bukan diketik", () => {
    // Bentuk tanggal yang salah ketik baru ditolak server setelah seluruh
    // tabelnya terlanjur diisi.
    expect(tabel).toContain("<DatePicker");
  });

  it("menu keberhasilan pasar dicentang dari katalog ESB, bukan diketik", () => {
    // Nama menu yang diketik sendiri tidak akan pernah cocok dengan nama di
    // ESB, dan penjualannya berhenti terbaca tanpa satu pun pesan salah.
    expect(tabel).toContain("export function FormMenuPasar");
    expect(tabel).toContain("simpanMenuPasarMassalAction");
    expect(papan).toContain("<FormMenuPasar");
    expect(papan).toContain("katalog={menuEsb}");
  });

  it("form tabel tidak muncul saat bulannya sudah dikunci", () => {
    // Bulan yang dikunci berarti laporannya sudah dibagikan; satu baris yang
    // masuk sesudahnya mengubah angka yang sudah dibaca orang.
    for (const form of ["<FormKegiatan", "<FormMenuPasar", "<FormEfisiensi", "<FormFee"]) {
      const i = papan.indexOf(form);
      expect(i, `${form} tidak ada di halaman`).toBeGreaterThan(-1);
      expect(papan.slice(Math.max(0, i - 400), i), `${form} tanpa penjagaan bulan terkunci`).toContain("!laporan.dikunci");
    }
  });
});

describe("bukti yang wajib tidak bisa dihindari", () => {
  it("entri berbukti ditolak server bila lampirannya kosong", () => {
    // Tanpa ini, cukup mengetik 40 baris kosong untuk mendapat nilai penuh
    // Hygiene Audit — dan tidak ada satu pun cara memeriksanya kembali.
    expect(aksi).toContain('const WAJIB_BUKTI: JenisEntri[] = ["hygiene_cctv"]');
    expect(aksi).toContain("WAJIB_BUKTI.includes(input.jenis) && (input.lampiran ?? []).length === 0");
  });

  it("jalur tabel massal tidak bisa dipakai untuk menghindarinya", () => {
    // Form tabel tidak membawa lampiran; kalau jenis berbukti boleh lewat sana,
    // penjagaannya tinggal dihindari dengan memilih form yang lain.
    const blok = aksi.slice(aksi.indexOf("export async function simpanEntriMassalAction"));
    expect(blok.slice(0, blok.indexOf("\nexport async function", 1))).toContain("WAJIB_BUKTI.includes(input.jenis)");
  });
});
