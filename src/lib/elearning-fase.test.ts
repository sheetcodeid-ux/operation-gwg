import { describe, expect, it } from "vitest";
import {
  faseBerjalan,
  faseKuisValid,
  faseSelesai,
  faseTerbuka,
  nilaiResmi,
  selisihBelajar,
  type KeadaanFase,
} from "./elearning-fase";

const keadaan = (p: Partial<KeadaanFase> = {}): KeadaanFase => ({
  adaKuis: { pre: true, kasus: true, post: true },
  sudahDikerjakan: {},
  materiTuntas: false,
  ...p,
});

describe("urutan fase belajar", () => {
  it("di awal hanya Pre Test yang terbuka", () => {
    const t = faseTerbuka(keadaan());
    expect(t).toEqual({ pre: true, kasus: false, materi: false, post: false });
  });

  it("Studi Kasus terbuka setelah Pre Test dikerjakan", () => {
    const t = faseTerbuka(keadaan({ sudahDikerjakan: { pre: true } }));
    expect(t.kasus).toBe(true);
    expect(t.materi).toBe(false);
  });

  it("Materi Utama terbuka setelah Studi Kasus dikerjakan", () => {
    const t = faseTerbuka(keadaan({ sudahDikerjakan: { pre: true, kasus: true } }));
    expect(t.materi).toBe(true);
    expect(t.post).toBe(false);
  });

  it("Post Test TERKUNCI sampai materi utama tuntas", () => {
    // Inti seluruh aturannya. Tanpa kunci ini, jalan tercepat menyelesaikan
    // sebuah materi adalah melewatinya.
    const belum = faseTerbuka(keadaan({ sudahDikerjakan: { pre: true, kasus: true } }));
    expect(belum.post).toBe(false);
    const tuntas = faseTerbuka(keadaan({ sudahDikerjakan: { pre: true, kasus: true }, materiTuntas: true }));
    expect(tuntas.post).toBe(true);
  });

  it("materi tuntas saja tidak membuka Post Test bila fase sebelumnya dilewati", () => {
    // Materi tidak mungkin tuntas sebelum dibuka, tapi datanya bisa saja
    // mengatakan begitu (mis. progres lama sebelum fase diberlakukan). Kuncinya
    // tetap harus utuh.
    const t = faseTerbuka(keadaan({ materiTuntas: true }));
    expect(t.post).toBe(false);
  });
});

describe("fase yang tidak punya soal tidak menghalangi", () => {
  it("tanpa Pre Test, Studi Kasus langsung terbuka", () => {
    const t = faseTerbuka(keadaan({ adaKuis: { kasus: true, post: true } }));
    expect(t.kasus).toBe(true);
  });

  it("tanpa Pre Test dan Studi Kasus, materi langsung terbuka", () => {
    const t = faseTerbuka(keadaan({ adaKuis: { post: true } }));
    expect(t.materi).toBe(true);
  });

  it("materi tanpa soal sama sekali tetap bisa dijalani sampai selesai", () => {
    // Kalau fase kosong ikut mengunci, orangnya tertahan menunggu sesuatu yang
    // tidak ada — dan itu keadaan yang mustahil ia keluar sendiri.
    const k = keadaan({ adaKuis: {}, materiTuntas: true });
    expect(faseTerbuka(k).materi).toBe(true);
    expect(faseSelesai(k)).toBe(true);
  });
});

describe("fase yang sedang berjalan", () => {
  it("menunjuk fase pertama yang belum tuntas", () => {
    expect(faseBerjalan(keadaan())).toBe("pre");
    expect(faseBerjalan(keadaan({ sudahDikerjakan: { pre: true } }))).toBe("kasus");
    expect(faseBerjalan(keadaan({ sudahDikerjakan: { pre: true, kasus: true } }))).toBe("materi");
    expect(faseBerjalan(keadaan({ sudahDikerjakan: { pre: true, kasus: true }, materiTuntas: true }))).toBe("post");
  });

  it("melompati fase yang memang tidak ada soalnya", () => {
    expect(faseBerjalan(keadaan({ adaKuis: { post: true } }))).toBe("materi");
  });
});

describe("selesai seluruhnya", () => {
  it("belum selesai selama materinya belum tuntas", () => {
    expect(faseSelesai(keadaan({ sudahDikerjakan: { pre: true, kasus: true, post: true } }))).toBe(false);
  });

  it("belum selesai selama Post Test belum dikerjakan", () => {
    expect(faseSelesai(keadaan({ materiTuntas: true }))).toBe(false);
  });

  it("selesai saat materi tuntas dan Post Test dikerjakan", () => {
    expect(faseSelesai(keadaan({ materiTuntas: true, sudahDikerjakan: { post: true } }))).toBe(true);
  });
});

describe("nilai yang dipakai adalah percobaan pertama", () => {
  it("mengambil percobaan pertama, bukan yang tertinggi", () => {
    // Memakai nilai terbaik membuat angka akhirnya hanya menunjukkan siapa yang
    // paling telaten mengulang, bukan siapa yang paham.
    expect(nilaiResmi([{ attempt: 1, score: 60 }, { attempt: 2, score: 95 }])).toBe(60);
  });

  it("tidak bergantung urutan daftarnya", () => {
    expect(nilaiResmi([{ attempt: 3, score: 100 }, { attempt: 1, score: 55 }, { attempt: 2, score: 80 }])).toBe(55);
  });

  it("belum ada percobaan berarti belum ada nilai, bukan nol", () => {
    expect(nilaiResmi([])).toBeNull();
  });

  it("nilai pertama yang jelek tetap dipakai", () => {
    expect(nilaiResmi([{ attempt: 1, score: 0 }, { attempt: 2, score: 100 }])).toBe(0);
  });
});

describe("selisih belajar", () => {
  it("Post Test dikurangi Pre Test", () => {
    expect(selisihBelajar(40, 85)).toBe(45);
  });

  it("selisih bisa negatif dan tidak disembunyikan", () => {
    expect(selisihBelajar(80, 60)).toBe(-20);
  });

  it("belum bisa dihitung bukan berarti nol", () => {
    // "0" terbaca sebagai "tidak ada kemajuan", padahal artinya "belum ada
    // angkanya" — dua hal yang menuntut tindakan berbeda.
    expect(selisihBelajar(null, 90)).toBeNull();
    expect(selisihBelajar(50, null)).toBeNull();
  });
});

describe("faseKuisValid", () => {
  it("menerima fase yang berupa soal", () => {
    for (const f of ["pre", "kasus", "post"]) expect(faseKuisValid(f)).toBe(true);
  });

  it("menolak materi dan nilai asing", () => {
    // "materi" memang fase, tapi bukan soal — ia tidak punya kuis.
    expect(faseKuisValid("materi")).toBe(false);
    expect(faseKuisValid("")).toBe(false);
    expect(faseKuisValid("POST")).toBe(false);
  });
});
