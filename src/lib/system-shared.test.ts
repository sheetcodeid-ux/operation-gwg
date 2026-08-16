import { describe, expect, it } from "vitest";
import {
  SYS_REQUEST_TYPES,
  SYS_SATISFACTION,
  SYS_TYPE_LABEL,
  selisihMs,
  selisihSingkat,
} from "./system-shared";

describe("kategori IT Help Desk", () => {
  it("tidak ada nilai kategori yang kembar", () => {
    const nilai = SYS_REQUEST_TYPES.map((t) => t.value);
    expect(nilai.length).toBe(new Set(nilai).size);
  });

  it("setiap kategori punya label, ikon, dan contoh nyata", () => {
    for (const t of SYS_REQUEST_TYPES) {
      expect(t.label.length).toBeGreaterThan(2);
      expect(t.icon.length).toBeGreaterThan(1);
      // Contohnya yang membuat orang memilih kategori benar tanpa berpikir;
      // kategori tanpa contoh sama saja dengan dropdown polos.
      expect(t.hint.length).toBeGreaterThan(10);
    }
  });

  it("peta label mencakup seluruh kategori", () => {
    for (const t of SYS_REQUEST_TYPES) expect(SYS_TYPE_LABEL[t.value]).toBe(t.label);
  });

  it("kategori tersering ada di urutan awal", () => {
    // Yang wifi-nya mati tidak boleh harus membaca sampai bawah dulu.
    expect(SYS_REQUEST_TYPES[0].value).toBe("jaringan");
  });
});

describe("selisihSingkat", () => {
  const T = (iso: string) => `2026-08-16T${iso}Z`;

  it("menit untuk selisih di bawah satu jam", () => {
    expect(selisihSingkat(T("08:00:00"), T("08:07:00"))).toBe("7 mnt");
  });

  it("jam dan menit untuk selisih di bawah sehari", () => {
    expect(selisihSingkat(T("08:00:00"), T("11:30:00"))).toBe("3 jam 30 mnt");
    expect(selisihSingkat(T("08:00:00"), T("11:00:00"))).toBe("3 jam");
  });

  it("hari untuk selisih panjang", () => {
    expect(selisihSingkat("2026-08-14T08:00:00Z", "2026-08-16T08:00:00Z")).toBe("2 hari");
    expect(selisihSingkat("2026-08-14T08:00:00Z", "2026-08-16T14:00:00Z")).toBe("2 hari 6 jam");
  });

  it("selisih di bawah satu menit tidak ditampilkan sebagai nol", () => {
    // "0 mnt" terbaca seperti belum terukur, padahal justru direspons seketika.
    expect(selisihSingkat(T("08:00:00"), T("08:00:20"))).toBe("< 1 mnt");
  });

  it("null saat salah satu waktunya belum ada", () => {
    expect(selisihSingkat(null, T("08:00:00"))).toBeNull();
    expect(selisihSingkat(T("08:00:00"), null)).toBeNull();
  });

  it("null saat waktunya terbalik, bukan angka negatif", () => {
    // Jam server yang meleset pernah menghasilkan durasi negatif; menampilkan
    // "-3 jam" sebagai waktu respons lebih membingungkan daripada mengosongkan.
    expect(selisihSingkat(T("11:00:00"), T("08:00:00"))).toBeNull();
  });
});

describe("selisihMs", () => {
  it("mengembalikan milidetik untuk perata-rataan", () => {
    expect(selisihMs("2026-08-16T08:00:00Z", "2026-08-16T08:05:00Z")).toBe(300_000);
  });

  it("null saat belum lengkap atau terbalik", () => {
    expect(selisihMs(null, "2026-08-16T08:00:00Z")).toBeNull();
    expect(selisihMs("2026-08-16T09:00:00Z", "2026-08-16T08:00:00Z")).toBeNull();
  });
});

describe("tingkat kepuasan", () => {
  it("bernilai 1 sampai 5 tanpa kembar", () => {
    const n = SYS_SATISFACTION.map((s) => s.value).sort();
    expect(n).toEqual([1, 2, 3, 4, 5]);
  });

  it("tersusun dari yang terbaik ke terburuk", () => {
    expect(SYS_SATISFACTION.map((s) => s.value)).toEqual([5, 4, 3, 2, 1]);
  });
});
