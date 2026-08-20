import { describe, expect, it } from "vitest";
import { bolehMelayani, modeData, perluTandaDemo, variabelKurang } from "./mode";

const k = (p: Partial<Parameters<typeof modeData>[0]> = {}) => ({
  dbAktif: false,
  pengembangan: false,
  demoDiizinkan: false,
  // Basis data aktif DAN terbaca adalah keadaan normal; masing-masing uji yang
  // menyoal kegagalan koneksi mematikannya sendiri.
  hidrasiBerhasil: true,
  ...p,
});

describe("modeData", () => {
  it("basis data aktif selalu menang, apa pun keadaan lainnya", () => {
    expect(modeData(k({ dbAktif: true }))).toBe("basis-data");
    expect(modeData(k({ dbAktif: true, pengembangan: true, demoDiizinkan: true }))).toBe("basis-data");
  });

  it("next dev tanpa basis data jalan sebagai demo", () => {
    expect(modeData(k({ pengembangan: true }))).toBe("demo");
  });

  it("build produksi dengan GWG_DEMO=1 jalan sebagai demo", () => {
    expect(modeData(k({ demoDiizinkan: true }))).toBe("demo");
  });

  it("build produksi tanpa basis data dan tanpa izin TIDAK melayani", () => {
    // Inilah perilaku yang diperbaiki: dulu keadaan ini menyajikan 59 orang
    // karangan tanpa satu pun tanda bahwa datanya bukan kenyataan.
    expect(modeData(k())).toBe("tanpa-basis-data");
  });
});

describe("pintu kedua: basis data ada tapi tidak bisa dibaca", () => {
  it("belum sekali pun berhasil dibaca berarti gagal terhubung, bukan basis-data", () => {
    // Inilah yang terjadi 20 Agustus 2026: kuota Supabase habis, hidrasi gagal
    // di setiap instance baru, dan yang tersaji adalah data contoh bawaan —
    // padahal konfigurasinya terlihat benar sehingga tidak ada yang curiga.
    expect(modeData(k({ dbAktif: true, hidrasiBerhasil: false }))).toBe("gagal-terhubung");
  });

  it("tidak melayani halaman saat gagal terhubung", () => {
    expect(bolehMelayani("gagal-terhubung")).toBe(false);
  });

  it("informasi yang belum ada diperlakukan sebagai belum berhasil", () => {
    // Saat ragu, jangan menyajikan data contoh.
    expect(modeData({ dbAktif: true, pengembangan: false, demoDiizinkan: false })).toBe("gagal-terhubung");
  });

  it("sudah pernah berhasil tetap melayani, walau penyegaran berikutnya gagal", () => {
    // Data SUNGGUHAN yang agak lama masih layak disajikan — itu memang cara
    // singgahan ini dirancang. Yang tidak boleh adalah data karangan.
    expect(modeData(k({ dbAktif: true, hidrasiBerhasil: true }))).toBe("basis-data");
  });

  it("mode demo tidak terpengaruh keadaan hidrasi", () => {
    // Tanpa basis data, hidrasi memang tidak pernah jalan.
    expect(modeData(k({ pengembangan: true, hidrasiBerhasil: false }))).toBe("demo");
  });

  it("gagal terhubung TIDAK diberi pita data contoh — layarnya memang tidak tampil", () => {
    expect(perluTandaDemo("gagal-terhubung")).toBe(false);
  });
});

describe("bolehMelayani", () => {
  it("hanya menolak saat tidak ada basis data dan demo tidak diizinkan", () => {
    expect(bolehMelayani("basis-data")).toBe(true);
    expect(bolehMelayani("demo")).toBe(true);
    expect(bolehMelayani("tanpa-basis-data")).toBe(false);
  });
});

describe("perluTandaDemo", () => {
  it("demo selalu diberi tanda, walau memang disengaja", () => {
    // Yang menjalankan tahu apa yang ia jalankan; yang dikirimi tautannya belum tentu.
    expect(perluTandaDemo("demo")).toBe(true);
  });

  it("data sungguhan tidak diberi tanda", () => {
    expect(perluTandaDemo("basis-data")).toBe(false);
  });
});

describe("variabelKurang", () => {
  it("kosong bila keduanya terisi", () => {
    expect(variabelKurang({ GWG_SUPABASE_URL: "x", SUPABASE_SERVICE_ROLE_KEY: "y" })).toEqual([]);
  });

  it("kunci cadangan dianggap cukup", () => {
    expect(variabelKurang({ GWG_SUPABASE_URL: "x", GWG_SUPABASE_KEY: "y" })).toEqual([]);
  });

  it("menyebut URL yang hilang", () => {
    expect(variabelKurang({ SUPABASE_SERVICE_ROLE_KEY: "y" })).toEqual(["GWG_SUPABASE_URL"]);
  });

  it("menyebut kunci yang hilang sebagai satu syarat, bukan dua", () => {
    expect(variabelKurang({ GWG_SUPABASE_URL: "x" })).toEqual([
      "SUPABASE_SERVICE_ROLE_KEY (atau GWG_SUPABASE_KEY)",
    ]);
  });

  it("keduanya hilang disebut keduanya", () => {
    expect(variabelKurang({})).toHaveLength(2);
  });

  it("hanya menyebut NAMA variabel, tidak pernah nilainya", () => {
    // Halaman galat ini terlihat siapa pun yang membuka alamatnya.
    const hasil = variabelKurang({ GWG_SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "rahasia-sekali" });
    expect(hasil.join(" ")).not.toContain("rahasia-sekali");
  });
});
