import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Sewa waktu ESB.
 *
 * Dua penarikan yang berjalan bersamaan saling merebut sesi ESB, dan yang kalah
 * tidak berhenti dengan pesan yang jelas — ia menerima balasan yang tidak bisa
 * diuraikan lalu melewati bagiannya diam-diam.
 */

const kunci = readFileSync(join(process.cwd(), "src/lib/data/esb-lock.ts"), "utf8");
const rute = readFileSync(join(process.cwd(), "src/app/api/cron/fraud-sync/route.ts"), "utf8");

describe("pengambilan sewa", () => {
  it("satu perintah ber-syarat, bukan baca lalu tulis", () => {
    // Membaca sewa lalu menulisnya menyisakan celah di antara keduanya — dan
    // celah sekecil itu persis yang ditemukan dua cron yang berangkat
    // bersamaan.
    expect(kunci).toContain('.update({ lease_until: sampai })');
    expect(kunci).toContain('.lt("lease_until"');
    expect(kunci).toContain("if ((data ?? []).length > 0) return true;");
  });

  it("gagal membaca berarti TIDAK jalan", () => {
    // Menganggapnya bebas saat keadaannya tidak diketahui persis membuka
    // kembali hal yang dijaga.
    expect(kunci).toContain("if (error) return false;");
  });

  it("sewanya berbatas waktu, jadi tidak ada yang terkunci selamanya", () => {
    expect(kunci).toContain("Date.now() + ms");
  });

  it("barisnya yang hilang tidak menghentikan seluruh penarikan selamanya", () => {
    // Nol baris biasanya berarti "ada yang sedang jalan". Kalau barisnya
    // memang tidak ada, tiap pemanggilan akan menjawab hal yang sama padahal
    // tidak ada siapa-siapa — dan penarikan berhenti tanpa satu pun pesan.
    expect(kunci).toContain('.eq("name", NAMA).maybeSingle()');
    expect(kunci).toContain('if (!ada) await db().from("esb_lock").insert(');
  });
});

describe("pemakaiannya di rute cron", () => {
  it("seluruh pekerjaan ESB berada di dalam sewa", () => {
    expect(rute).toContain("await ambilKunciEsb(");
    expect(rute).toContain("return await jalankan(req);");
  });

  it("selalu dilepas, termasuk saat pekerjaannya gagal", () => {
    expect(rute).toContain("} finally {");
    expect(rute).toContain("await lepasKunciEsb();");
  });

  it("yang datang belakangan pulang, tidak mengantre", () => {
    // Mengantre di dalam permintaan berumur 60 detik membuat dua-duanya
    // kehabisan waktu.
    expect(rute).toContain("ada penarikan ESB lain yang sedang jalan");
  });
});
