import { describe, expect, it } from "vitest";
import {
  ALUR_ASSESSMENT,
  CARA_KERJA_AKUMULASI,
  rerata,
  ringkasAssessment,
  ringkasProgram,
  statusTahap,
} from "./assessment-materi";
import { MATERI_FAST_TRACK, NILAI_LULUS } from "./lanjutan";
import type { RekamanPelatihan } from "./pelatihan";

const baris = (p: Partial<RekamanPelatihan>): RekamanPelatihan => ({
  nama: "Budi",
  materi: "Company Profile",
  program: "fast_start",
  batch: "B1",
  outletName: null,
  tanggal: "2026-01-10",
  preTest: null,
  rolePlay: null,
  postTest: null,
  ...p,
});

/** Seluruh sepuluh materi terisi nilai yang sama — dipakai menguji program penuh. */
const semuaMateri = (pre: number, rp: number, post: number): RekamanPelatihan[] =>
  MATERI_FAST_TRACK.map((m) => baris({ materi: m.judul, preTest: pre, rolePlay: rp, postTest: post }));

describe("statusTahap", () => {
  it("tanpa peserta berarti belum mulai", () => {
    expect(statusTahap([])).toBe("belum");
  });

  it("ada peserta tapi belum satu pun dinilai tetap belum mulai", () => {
    expect(statusTahap([null, null])).toBe("belum");
  });

  it("sebagian dinilai berarti berjalan", () => {
    expect(statusTahap([80, null])).toBe("berjalan");
  });

  it("semua dinilai berarti selesai", () => {
    expect(statusTahap([80, 40])).toBe("selesai");
  });

  it("nilai nol tetap dihitung sebagai sudah dinilai", () => {
    expect(statusTahap([0])).toBe("selesai");
  });
});

describe("rerata", () => {
  it("mengabaikan nilai kosong", () => {
    expect(rerata([80, null, 60])).toBe(70);
  });

  it("null bila tidak ada nilai sama sekali", () => {
    expect(rerata([null, null])).toBeNull();
  });

  it("dibulatkan satu desimal", () => {
    expect(rerata([80, 85, 91])).toBe(85.3);
  });
});

describe("ringkasAssessment", () => {
  it("selalu memuat sepuluh materi Fast Start / Fast Track", () => {
    const rows = ringkasAssessment([]);
    expect(rows.map((r) => r.judul)).toEqual(MATERI_FAST_TRACK.map((m) => m.judul));
    expect(rows.every((r) => r.hasil === "menunggu" && r.peserta === 0)).toBe(true);
  });

  it("nilai akumulasi sebuah materi adalah Post Test-nya, bukan campuran dengan Pre Test", () => {
    const rows = ringkasAssessment([baris({ preTest: 50, postTest: 90 })]);
    const cp = rows.find((r) => r.judul === "Company Profile")!;
    expect(cp.akumulasi).toBe(90);
    expect(cp.peningkatan).toBe(40);
  });

  it("Post Test yang belum lengkap membuat hasilnya menunggu, bukan gagal", () => {
    const rows = ringkasAssessment([
      baris({ nama: "A", postTest: 90 }),
      baris({ nama: "B", postTest: null }),
    ]);
    const cp = rows.find((r) => r.judul === "Company Profile")!;
    expect(cp.statusPost).toBe("berjalan");
    expect(cp.hasil).toBe("menunggu");
  });

  it("nilai di bawah ambang dinyatakan belum lulus", () => {
    const rows = ringkasAssessment([baris({ postTest: NILAI_LULUS - 1 })]);
    expect(rows.find((r) => r.judul === "Company Profile")!.hasil).toBe("belum_lulus");
  });

  it("tepat di ambang dinyatakan lulus", () => {
    const rows = ringkasAssessment([baris({ postTest: NILAI_LULUS })]);
    expect(rows.find((r) => r.judul === "Company Profile")!.hasil).toBe("lulus");
  });

  it("Role Play punya status sendiri, terpisah dari Post Test", () => {
    const rows = ringkasAssessment([baris({ rolePlay: 80, postTest: null })]);
    const cp = rows.find((r) => r.judul === "Company Profile")!;
    expect(cp.statusRolePlay).toBe("selesai");
    expect(cp.statusPost).toBe("belum");
  });
});

describe("ringkasProgram", () => {
  it("program belum bisa dinyatakan lulus selama ada materi yang belum selesai", () => {
    const r = ringkasProgram(ringkasAssessment([baris({ postTest: 90 })]));
    expect(r.materiSelesai).toBe(1);
    expect(r.hasilProgram).toBe("menunggu");
  });

  it("seluruh materi selesai dan di atas ambang berarti lulus", () => {
    const r = ringkasProgram(ringkasAssessment(semuaMateri(60, 80, 90)));
    expect(r.materiSelesai).toBe(MATERI_FAST_TRACK.length);
    expect(r.akumulasiProgram).toBe(90);
    expect(r.hasilProgram).toBe("lulus");
  });

  it("seluruh materi selesai tapi akumulasinya kurang berarti belum lulus", () => {
    const r = ringkasProgram(ringkasAssessment(semuaMateri(30, 40, NILAI_LULUS - 5)));
    expect(r.hasilProgram).toBe("belum_lulus");
  });

  it("rata-rata Pre dan Post hanya dari materi yang punya keduanya", () => {
    // Materi kedua baru punya Pre Test. Kalau ia ikut dihitung, rerata Post
    // tertarik ke bawah dan peningkatannya terbaca lebih kecil dari kenyataan.
    const rows = ringkasAssessment([
      baris({ materi: "Company Profile", preTest: 60, postTest: 90 }),
      baris({ materi: "Self Leadership", preTest: 20, postTest: null }),
    ]);
    const r = ringkasProgram(rows);
    expect(r.rerataPre).toBe(60);
    expect(r.rerataPost).toBe(90);
    expect(r.rerataPeningkatan).toBe(30);
  });

  it("tanpa data apa pun seluruh angkanya null, bukan nol", () => {
    const r = ringkasProgram(ringkasAssessment([]));
    expect(r.akumulasiProgram).toBeNull();
    expect(r.rerataPre).toBeNull();
    expect(r.rerataPeningkatan).toBeNull();
    expect(r.hasilProgram).toBe("menunggu");
    expect(r.nilaiMinimum).toBe(NILAI_LULUS);
  });
});

describe("penjelasan halaman", () => {
  it("alurnya lima tahap, urut dari Pre Test sampai sertifikasi", () => {
    expect(ALUR_ASSESSMENT.map((a) => a.judul)).toEqual([
      "Pre Test",
      "Role Play",
      "Post Test",
      "Perbandingan & Akumulasi Nilai",
      "Sertifikasi Kelulusan",
    ]);
  });

  it("ambang kelulusan yang ditulis di penjelasan sama dengan yang dipakai menghitung", () => {
    // Penjelasan yang menyebut angka berbeda dari aturannya adalah cara
    // tercepat membuat orang berhenti mempercayai halamannya.
    const teks = CARA_KERJA_AKUMULASI.map((c) => `${c.judul} ${c.isi}`).join(" ");
    expect(teks).toContain(String(NILAI_LULUS));
    expect(ALUR_ASSESSMENT.map((a) => a.isi).join(" ")).toContain(String(NILAI_LULUS));
  });

  it("seluruh materi disebutkan di penjelasan bobot", () => {
    const isi = CARA_KERJA_AKUMULASI[0].isi;
    for (const m of MATERI_FAST_TRACK) expect(isi).toContain(m.judul);
  });
});
