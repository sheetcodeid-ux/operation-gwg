import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * DAILY TIDAK BOLEH BERUBAH.
 *
 * Syarat yang diminta pemiliknya saat Weekly, Monthly, Quarterly, dan Yearly
 * ditambahkan: keempatnya memakai komponen yang sama dengan Daily, dan justru
 * karena itu Daily jadi rentan — satu label yang "digeneralkan" mengubah
 * halaman yang sudah dipakai tiap hari.
 *
 * Jalan yang dipilih: seluruh sifat baru berupa prop BERNILAI BAWAAN, dan
 * bawaannya persis perilaku Daily. Berkas ini menjaga bawaan itu tidak
 * bergeser — karena kalau bergeser, yang berubah bukan halaman baru melainkan
 * halaman lama.
 */

const tabel = readFileSync(join(process.cwd(), "src/components/operation/tabel-harian.tsx"), "utf8");
const halaman = readFileSync(join(process.cwd(), "src/app/(app)/operational/daily/page.tsx"), "utf8");

describe("bawaan komponen tetap perilaku Daily", () => {
  it("label kolom agregat tetap Bulan Ini", () => {
    expect(tabel).toContain('labelAgregat = "Bulan Ini"');
  });

  it("keterangan pembanding tetap kalimat Daily", () => {
    expect(tabel).toContain('labelBanding = "vs tanggal sama bulan lalu"');
  });

  it("tanpa `nav`, penavigasinya tetap melangkah per bulan", () => {
    expect(tabel).toContain("nav ? nav.sebelum : geserBulan(detail.periode, -1)");
    expect(tabel).toContain("nav ? nav.sesudah : geserBulan(detail.periode, 1)");
    expect(tabel).toContain("nav ? nav.judul : labelBulan(detail.periode)");
  });

  it("tanpa `nav`, alamat dan parameternya tetap milik Daily", () => {
    expect(tabel).toContain('const param = nav?.param ?? "bulan";');
    expect(tabel).toContain('const href = nav?.href ?? "/operational/daily";');
  });

  it("satuan sisa pengejaran tetap hari", () => {
    expect(tabel).toContain('satuan = "hari"');
  });

  it("angka agregat tetap ditulis penuh", () => {
    // Daily memperlihatkan "Rp 1.939.979.532", bukan "Rp 1,9 M".
    expect(tabel).toContain("ringkas = false");
  });

  it("kepala kolom tanpa label tetap tanggal dua digit", () => {
    expect(tabel).toContain('h.label ?? String(h.tanggal).padStart(2, "0")');
  });
});

describe("halaman Daily tidak ikut diubah", () => {
  it("masih memanggil harianOutlet, bukan penarik skala baru", () => {
    // Daily berjalan di atas jalur yang sudah terbukti. Memindahkannya ke
    // mesin baru berarti mempertaruhkan halaman yang dipakai tiap hari demi
    // kerapian yang tidak diminta siapa pun.
    expect(halaman).toContain("harianOutlet");
    expect(halaman).not.toContain("performaOutlet");
  });

  it("tidak mengirim satu pun prop skala", () => {
    expect(halaman).not.toContain("labelAgregat");
    expect(halaman).not.toContain("nav={");
  });
});
