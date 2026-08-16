import { describe, expect, it } from "vitest";
import { pesanRingkas } from "./pesan-galat";

describe("pesanRingkas", () => {
  it("membuang ekor teknis di dalam kurung siku", () => {
    const utuh =
      "ESB membalas halaman web, bukan data — biasanya karena ESB sedang bermasalah atau dalam pemeliharaan. Coba lagi beberapa menit lagi. [report-cancel-menu-detail] isi: 502 Bad Gateway nginx";
    expect(pesanRingkas(utuh)).toBe(
      "ESB membalas halaman web, bukan data — biasanya karena ESB sedang bermasalah atau dalam pemeliharaan. Coba lagi beberapa menit lagi.",
    );
  });

  it("membiarkan pesan biasa apa adanya", () => {
    expect(pesanRingkas("Tidak punya akses.")).toBe("Tidak punya akses.");
  });

  it("tidak mengosongkan pesan yang seluruhnya teknis", () => {
    // Tidak ada kalimat sebelum kurung siku, jadi tidak ada yang boleh dipotong
    // — lebih baik teknis daripada kosong.
    const teknis = "[esb] ECONNRESET";
    expect(pesanRingkas(teknis)).toBe(teknis);
  });

  it("memotong pesan yang terlalu panjang di batas kata", () => {
    const panjang = "kata ".repeat(60).trim();
    const hasil = pesanRingkas(panjang, 40);
    expect(hasil.length).toBeLessThanOrEqual(41); // 40 + elipsis
    expect(hasil.endsWith("…")).toBe(true);
    expect(hasil).not.toMatch(/ka…$/); // tidak terputus di tengah kata
  });

  it("memberi kalimat pengganti kalau pesannya kosong", () => {
    expect(pesanRingkas("")).toBe("Terjadi kesalahan.");
    expect(pesanRingkas("   ")).toBe("Terjadi kesalahan.");
  });
});
