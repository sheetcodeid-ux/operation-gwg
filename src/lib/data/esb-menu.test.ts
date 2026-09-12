import { describe, expect, it } from "vitest";
import { rentangTigaBulan } from "./esb-menu";
import { formatRentang } from "@/lib/utils";

/**
 * Jendela katalog menu ESB.
 *
 * Yang dijaga di sini adalah kesalahan yang pernah terjadi dan mahal: katalog
 * yang jendelanya tidak bisa dicocokkan dengan laporan ESB mana pun, dan
 * kalimat "30 hari terakhir" yang tertulis di layar sementara datanya bukan 30
 * hari. Keduanya tidak pernah gagal dengan sendirinya — hanya menghasilkan
 * angka yang salah dengan tenang.
 */
describe("rentangTigaBulan", () => {
  const pada = (iso: string) => rentangTigaBulan(new Date(`${iso}T00:00:00Z`));

  it("12 September 2026 berarti 1 Juni – 31 Agustus", () => {
    // Persis contoh yang dipakai pemiliknya saat melaporkan angkanya salah.
    expect(pada("2026-09-12")).toEqual({ from: "2026-06-01", to: "2026-08-31", days: 92 });
  });

  it("bulan berjalan TIDAK ikut — angkanya masih bertambah tiap hari", () => {
    // Tanggal berapa pun dalam September memberi jendela yang sama; katalog
    // yang bergerak sendiri tiap hari tidak bisa dicocokkan dengan laporan
    // ESB mana pun, dan dua orang yang membukanya di hari berbeda akan
    // melihat angka berbeda untuk bulan yang sama.
    expect(pada("2026-09-01")).toEqual(pada("2026-09-30"));
  });

  it("selalu tiga bulan kalender penuh, bukan 90 hari bergulir", () => {
    for (const hari of ["2026-01-15", "2026-03-01", "2026-07-31", "2026-12-25"]) {
      const r = pada(hari);
      expect(r.from.slice(8), hari).toBe("01");
      // Akhirnya hari terakhir bulan sebelum bulan berjalan.
      const akhir = new Date(`${r.to}T00:00:00Z`);
      const besok = new Date(akhir.getTime() + 86_400_000);
      expect(besok.getUTCDate(), hari).toBe(1);
    }
  });

  it("menyeberang tahun dengan benar", () => {
    expect(pada("2026-02-10")).toEqual({ from: "2025-11-01", to: "2026-01-31", days: 92 });
    expect(pada("2026-01-05")).toEqual({ from: "2025-10-01", to: "2025-12-31", days: 92 });
  });

  it("Februari pendek ikut terhitung apa adanya", () => {
    // Des+Jan+Feb 2026 = 31 + 31 + 28.
    expect(pada("2026-03-20")).toEqual({ from: "2025-12-01", to: "2026-02-28", days: 90 });
  });
});

describe("formatRentang", () => {
  it("menulis rentangnya sebagai kalimat pendek", () => {
    expect(formatRentang("2026-06-01", "2026-08-31")).toBe("1 Jun – 31 Agu 2026");
  });

  it("tahun disebut dua kali bila rentangnya menyeberang tahun", () => {
    expect(formatRentang("2025-11-01", "2026-01-31")).toBe("1 Nov 2025 – 31 Jan 2026");
  });

  it("kosong bila tanggalnya belum ada — bukan menebak", () => {
    expect(formatRentang(null, "2026-08-31")).toBeNull();
    expect(formatRentang("2026-06-01", null)).toBeNull();
    expect(formatRentang("bukan tanggal", "juga bukan")).toBeNull();
  });
});
