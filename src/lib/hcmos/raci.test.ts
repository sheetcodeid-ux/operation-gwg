import { describe, expect, it } from "vitest";
import {
  KOSONG,
  cocokBaris,
  gabungNama,
  hitungPeran,
  pecahNama,
  perOrang,
  periksaRaci,
  peranOrangDiBaris,
  semuaNama,
  susunMatriks,
  type BarisRaci,
} from "./raci";

const baris = (patch: Partial<BarisRaci> = {}): BarisRaci => ({
  pilarSlug: "organization-development",
  pilarLabel: "Organization Development",
  pilarPic: "Riva",
  subSlug: "database-karyawan",
  subLabel: "Database Karyawan",
  fungsi: "Data karyawan Manajemen dan rekap seluruh outlet.",
  raci: { R: "Uswatun", A: "Adrian", C: "Riva", I: "Outlet Manager" },
  disunting: [],
  ...patch,
});

describe("membaca isi sel", () => {
  it("satu sel bisa memuat beberapa orang", () => {
    expect(pecahNama("Uswatun, Head of Operation")).toEqual(["Uswatun", "Head of Operation"]);
  });

  it("mengenali pemisah lain yang dipakai matriks aslinya", () => {
    expect(pecahNama("Riva / Uswatun")).toEqual(["Riva", "Uswatun"]);
    expect(pecahNama("Adrian dan Riva")).toEqual(["Adrian", "Riva"]);
  });

  it("tanda strip berarti tidak ada pemegangnya, bukan orang bernama strip", () => {
    expect(pecahNama(KOSONG)).toEqual([]);
    expect(pecahNama("")).toEqual([]);
    expect(pecahNama(null)).toEqual([]);
  });

  it("digabung kembali tanpa duplikat, dan kosong tetap terbaca kosong", () => {
    expect(gabungNama(["Riva", "Riva", " Adrian "])).toBe("Riva, Adrian");
    expect(gabungNama([])).toBe(KOSONG);
    expect(pecahNama(gabungNama(["Uswatun", "Head of Operation"]))).toEqual(["Uswatun", "Head of Operation"]);
  });
});

describe("bawaan Juknis ditimpa suntingan", () => {
  it("tanpa suntingan, isinya persis matriks Juknis", () => {
    const m = susunMatriks();
    expect(m.length).toBeGreaterThan(0);
    expect(m.every((b) => b.disunting.length === 0)).toBe(true);
  });

  it("suntingan menimpa satu peran saja, sisanya utuh", () => {
    const asal = susunMatriks()[0];
    const m = susunMatriks([
      { pilarSlug: asal.pilarSlug, subSlug: asal.subSlug, peran: "R", pemegang: "Orang Baru" },
    ]);
    const sesudah = m.find((b) => b.subSlug === asal.subSlug)!;
    expect(sesudah.raci.R).toBe("Orang Baru");
    expect(sesudah.raci.A).toBe(asal.raci.A);
    expect(sesudah.disunting).toEqual(["R"]);
  });

  it("suntingan yang isinya sama dengan bawaan tidak dihitung sebagai suntingan", () => {
    const asal = susunMatriks()[0];
    const m = susunMatriks([
      { pilarSlug: asal.pilarSlug, subSlug: asal.subSlug, peran: "A", pemegang: asal.raci.A },
    ]);
    expect(m.find((b) => b.subSlug === asal.subSlug)!.disunting).toEqual([]);
  });

  it("suntingan untuk aktivitas yang sudah tidak ada diabaikan, tidak menambah baris", () => {
    // Sub-menu bisa hilang sementara saat kerangka disusun ulang. Suntingannya
    // tetap tersimpan, tapi tidak boleh memunculkan baris hantu di matriks.
    const jumlahAsli = susunMatriks().length;
    const m = susunMatriks([{ pilarSlug: "pilar-hantu", subSlug: "sub-hantu", peran: "R", pemegang: "Siapa" }]);
    expect(m.length).toBe(jumlahAsli);
  });
});

describe("membaca dari sisi orangnya", () => {
  const data = [
    baris({ subSlug: "a", subLabel: "A", raci: { R: "Uswatun", A: "Adrian", C: "Riva", I: KOSONG } }),
    baris({ subSlug: "b", subLabel: "B", raci: { R: "Riva", A: "Adrian", C: "Uswatun", I: "Seluruh Karyawan" } }),
    baris({ subSlug: "c", subLabel: "C", raci: { R: "Riva", A: "Riva", C: KOSONG, I: "Adrian" } }),
  ];

  it("mengumpulkan seluruh tugas satu orang dari kolom mana pun", () => {
    const riva = perOrang(data).find((o) => o.nama === "Riva")!;
    expect(riva.total).toBe(4);
    expect(riva.jumlah).toEqual({ R: 2, A: 1, C: 1, I: 0 });
  });

  it("diurutkan menurut beban, bukan abjad", () => {
    // Adrian memegang 2 A; Riva 1 A. Urut abjad akan menaruh Adrian di atas
    // juga — jadi diuji dengan nama yang abjadnya melawan bebannya.
    const urut = perOrang([
      baris({ subSlug: "x", raci: { R: "Zulfa", A: "Zulfa", C: KOSONG, I: KOSONG } }),
      baris({ subSlug: "y", raci: { R: "Zulfa", A: "Zulfa", C: KOSONG, I: "Ani" } }),
    ]).map((o) => o.nama);
    expect(urut[0]).toBe("Zulfa");
  });

  it("nama yang sama di dua kolom pada satu baris dihitung dua tugas", () => {
    const riva = perOrang([data[2]]).find((o) => o.nama === "Riva")!;
    expect(riva.tugas.map((t) => t.peran).sort()).toEqual(["A", "R"]);
  });

  it("daftar nama tidak memuat tanda kosong", () => {
    expect(semuaNama(data)).not.toContain(KOSONG);
    expect(semuaNama(data)).toContain("Seluruh Karyawan");
  });

  it("jumlah penugasan dihitung per nama, bukan per sel", () => {
    // Satu sel berisi dua nama adalah DUA penugasan. Menghitung per sel membuat
    // legenda melaporkan angka yang lebih kecil dari kenyataan.
    expect(hitungPeran([baris({ raci: { R: "A, B", A: "C", C: KOSONG, I: KOSONG } })])).toEqual({
      R: 2,
      A: 1,
      C: 0,
      I: 0,
    });
  });
});

describe("pemeriksaan aturan RACI", () => {
  it("matriks yang benar tidak menghasilkan temuan", () => {
    expect(periksaRaci([baris()])).toEqual([]);
  });

  it("menolak aktivitas tanpa penanggung jawab akhir", () => {
    const t = periksaRaci([baris({ raci: { R: "Uswatun", A: KOSONG, C: KOSONG, I: KOSONG } })]);
    expect(t).toHaveLength(1);
    expect(t[0].berat).toBe("salah");
    expect(t[0].pesan).toContain("penanggung jawab akhir");
  });

  it("menolak dua penanggung jawab akhir sekaligus", () => {
    // Dua nama di kolom A terdengar seperti kehati-hatian, padahal akibatnya
    // sebaliknya: keduanya menganggap yang lain yang menutup.
    const t = periksaRaci([baris({ raci: { R: "Uswatun", A: "Adrian, Riva", C: KOSONG, I: KOSONG } })]);
    expect(t[0].berat).toBe("salah");
    expect(t[0].pesan).toContain("2 penanggung jawab akhir");
  });

  it("menolak aktivitas yang tidak ada yang mengerjakan", () => {
    const t = periksaRaci([baris({ raci: { R: KOSONG, A: "Adrian", C: KOSONG, I: KOSONG } })]);
    expect(t.some((x) => x.pesan.includes("mengerjakan"))).toBe(true);
  });

  it("menandai rangkap A dan satu-satunya R sebagai perhatian, bukan kesalahan", () => {
    const t = periksaRaci([baris({ raci: { R: "Adrian", A: "Adrian", C: KOSONG, I: KOSONG } })]);
    expect(t).toHaveLength(1);
    expect(t[0].berat).toBe("perhatian");
  });

  it("rangkap A dan R tidak ditandai bila ada pelaksana lain", () => {
    // Yang bermasalah adalah memeriksa pekerjaan SENDIRI. Kalau ada orang lain
    // yang juga mengerjakan, penanggung jawab yang ikut turun tangan itu wajar.
    expect(periksaRaci([baris({ raci: { R: "Adrian, Uswatun", A: "Adrian", C: KOSONG, I: KOSONG } })])).toEqual([]);
  });

  it("yang salah selalu berada di atas yang sekadar perlu diperhatikan", () => {
    const t = periksaRaci([
      baris({ subSlug: "p", raci: { R: "Adrian", A: "Adrian", C: KOSONG, I: KOSONG } }),
      baris({ subSlug: "q", raci: { R: "Uswatun", A: KOSONG, C: KOSONG, I: KOSONG } }),
    ]);
    expect(t[0].berat).toBe("salah");
  });

  it("matriks Juknis yang berlaku sekarang lolos aturannya sendiri", () => {
    // Penjaga yang paling berguna di berkas ini: kalau suatu saat ada sub-menu
    // baru ditambahkan ke Juknis tanpa RACI yang lengkap, tes ini yang
    // memberitahu — bukan orang yang kebetulan membuka halamannya.
    expect(periksaRaci(susunMatriks()).filter((t) => t.berat === "salah")).toEqual([]);
  });
});

describe("pencarian", () => {
  const b = baris();

  it("kata kosong berarti semuanya cocok", () => {
    expect(cocokBaris(b, "   ")).toBe(true);
  });

  it("mencari nama orang, bukan hanya judul aktivitas", () => {
    expect(cocokBaris(b, "uswatun")).toBe(true);
  });

  it("mencari judul dan pilarnya", () => {
    expect(cocokBaris(b, "database")).toBe(true);
    expect(cocokBaris(b, "organization")).toBe(true);
  });

  it("yang tidak ada tetap tidak ada", () => {
    expect(cocokBaris(b, "zulfikar")).toBe(false);
  });

  it("peran satu orang di satu baris terbaca dari kolom mana pun", () => {
    expect(peranOrangDiBaris(b, "Adrian")).toEqual(["A"]);
    expect(peranOrangDiBaris(b, "Zulfa")).toEqual([]);
  });
});

/**
 * Penjaga yang menghubungkan matriks ke halamannya.
 *
 * Keduanya pernah lepas: halaman kanvas yang lupa didaftarkan sebagai
 * full-bleed tetap dibungkus padding dan footer, sehingga tingginya melebihi
 * layar dan kepala tabel yang seharusnya menempel ikut terbawa naik — persis
 * saat mulai dibutuhkan.
 */
describe("halaman RACI adalah kanvas, bukan dokumen", () => {
  it("terdaftar sebagai halaman layar penuh", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const shell = readFileSync(join(process.cwd(), "src/components/layout/main-shell.tsx"), "utf8");
    expect(shell).toContain('"/hc-mos/raci"');
  });

  it("halamannya membaca suntingan, bukan hanya bawaan Juknis", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const page = readFileSync(join(process.cwd(), "src/app/(app)/hc-mos/raci/page.tsx"), "utf8");
    expect(page).toContain("getSuntinganRaci");
    expect(page).toContain("susunMatriks");
  });
});
