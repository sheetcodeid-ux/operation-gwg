import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canReachMenu, divisiPemilikKpi, type MenuKey } from "@/lib/nav";
import { MENU_POSISI, POSISI } from "./struktur";

/**
 * Memecah departemen di TABEL tidak boleh mengunci HALAMANNYA.
 *
 * Sosial Media dipisah dari Marketing Communication supaya capaiannya terbaca
 * sendiri. Hak akses KPI ternyata ikut nama departemen itu — dan karena tidak
 * seorang pun berdepartemen "Sosial Media" di User Management, Zia, Marta, dan
 * Dita kehilangan halaman yang mereka isi sendiri, pada hari yang sama.
 */
describe("KPI Sosial Media tetap bisa dibuka orangnya", () => {
  const zia = {
    role: "member" as const,
    department: "Marketing Communication",
    jabatan: "Social Media",
    grants: [],
  };

  it("Zia, Marta, dan Dita bisa membuka KPI Sosial Media", () => {
    expect(canReachMenu(zia, MENU_POSISI.creative_sosmed as MenuKey)).toBe(true);
  });

  it("pemiliknya divisi kerja orangnya, bukan nama departemen di tabel", () => {
    expect(divisiPemilikKpi("Marketing Communication", MENU_POSISI.creative_sosmed as MenuKey)).toBe(true);
  });

  it("yang di luar divisi itu tetap tertutup", () => {
    const lain = { role: "member" as const, department: "Supply Chain", jabatan: "Admin Penjualan", grants: [] };
    expect(canReachMenu(lain, MENU_POSISI.creative_sosmed as MenuKey)).toBe(false);
  });

  it("posisi lain tidak ikut terbuka untuk divisi itu", () => {
    // `divisiKerja` hanya menimpa satu posisi; kalau ia bocor ke posisi lain,
    // seluruh Marketing Communication bisa membuka rapor Finance.
    for (const p of POSISI) {
      if (p.kode === "creative_sosmed") continue;
      expect(
        divisiPemilikKpi("Marketing Communication", MENU_POSISI[p.kode] as MenuKey),
        `${p.kode} ikut terbuka`,
      ).toBe(p.kode === "marcomm");
    }
  });
});

describe("angka minus disimpan, bukan ditolak", () => {
  const aksi = readFileSync(join(process.cwd(), "src/lib/actions/kpi.ts"), "utf8");

  it("indikator persen boleh minus", () => {
    // Follower Growth memang bisa turun. Penolakan lama berbunyi "Angkanya
    // tidak masuk akal" — menyalahkan yang mengetik untuk aturan yang tidak
    // pernah disebutkan, dan yang mengetiknya menyimpulkan "tidak tersimpan".
    expect(aksi).not.toContain('input.nilai < 0) return { error: "Angkanya tidak masuk akal." }');
    expect(aksi).toContain('input.nilai < 0 && ind.satuan !== "persen"');
  });
});

describe("brand yang dikosongkan tidak ditimpa nol", () => {
  const dialog = readFileSync(join(process.cwd(), "src/components/kpi/dialog-input.tsx"), "utf8");

  it("hanya brand yang benar-benar diisi yang dikirim", () => {
    // Kotak kosong yang dikirim sebagai nol menghapus brand lain yang sudah
    // benar — dan dari luar itu terlihat persis seperti "tidak tersimpan".
    expect(dialog).toContain('WORK_BRANDS.filter((b) => (perBrand[b] ?? "").trim() !== "")');
    expect(dialog).not.toContain('nilai: num(perBrand[b] ?? "0")');
  });

  it("angka yang sudah tersimpan ditarik lebih dulu", () => {
    expect(dialog).toContain("actualTersimpanAction({ posisi, periode: periodeDipilih })");
  });
});
