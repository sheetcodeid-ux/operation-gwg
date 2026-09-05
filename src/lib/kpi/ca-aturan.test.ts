import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Aturan-aturan Coordinator Area yang kalau dilanggar TIDAK terlihat salah.
 *
 * Seluruhnya menghasilkan angka yang tetap masuk akal di layar — outlet baru
 * yang ikut terhitung, satu area yang terhitung tiga kali, HPP yang
 * dirata-ratakan begitu saja. Tidak ada yang akan mencurigainya, dan itu
 * sebabnya dijaga di sini.
 */

const data = readFileSync(join(process.cwd(), "src/lib/data/kpi.ts"), "utf8");
const papan = readFileSync(join(process.cwd(), "src/components/kpi/papan-kpi.tsx"), "utf8");
const halaman = readFileSync(join(process.cwd(), "src/app/(app)/kpi/[posisi]/page.tsx"), "utf8");
const aksiKpi = readFileSync(join(process.cwd(), "src/lib/actions/kpi.ts"), "utf8");

describe("aturan tiga bulan", () => {
  it("outlet yang belum genap tiga bulan tidak ikut dinilai SAMA SEKALI", () => {
    // Bukan hanya di Gross Sales: outlet baru selalu menyeret rata-rata ke
    // bawah, dan komplain awal yang wajar terhitung sebagai kegagalan.
    const blok = data.slice(data.indexOf("async function angkaCa"));
    const badan = blok.slice(0, blok.indexOf("\n/**", 1));
    expect(badan).toContain("belum.push(o)");
    // Komplain dihitung dari outlet yang LOLOS saja.
    expect(badan).toContain("komplainOutlet(periode, lolos.map((o) => o.id))");
  });

  it("yang menentukan adalah ada-tidaknya data, bukan tanggal yang diketik", () => {
    // Tanggal buka tidak pernah ada di basis data ini, dan yang diketik
    // belakangan hampir selalu tanggal yang diingat, bukan yang benar.
    const blok = data.slice(data.indexOf("function tigaBulanSebelum"));
    expect(blok.slice(0, 400)).toContain("bulanSebelum");
    expect(data).toContain("if (!tiga.every(berjalan))");
  });
});

describe("gross sales manual", () => {
  it("ESB selalu menang atas angka yang diketik", () => {
    // Angka yang bisa diperdebatkan tidak boleh mengalahkan angka yang tidak
    // bisa — kalau kalah, tidak akan ada yang tahu mana yang sedang dibaca.
    const blok = data.slice(data.indexOf("function grossOutlet"));
    const badan = blok.slice(0, blok.indexOf("\n}"));
    expect(badan).toContain("if (dariEsb !== undefined && dariEsb > 0) return dariEsb;");
    expect(badan).toContain("tangan.get(o.id)?.gross");
  });

  it("yang muncul HANYA outlet yang ditandai diisi tangan", () => {
    // Sempat ditebak dari keadaan datanya ("belum lolos tiga bulan"), dan
    // tebakan itu ikut menyeret outlet lain yang kebetulan juga belum genap
    // tiga bulan — daftarnya berubah-ubah tiap kali bulannya diganti, dan yang
    // mengisinya tidak pernah tahu mana yang benar-benar perlu diisi.
    const form = readFileSync(join(process.cwd(), "src/components/kpi/form-tabel.tsx"), "utf8");
    expect(form).toContain('outlet.filter((o) => o.grossManual)');
    expect(data).toContain("grossManual: o.grossManual");
  });

  it("penandanya data, bukan daftar nama di dalam kode", () => {
    // Outlet pindahan berikutnya cukup ditandai barisnya — tanpa deploy.
    const rows = readFileSync(join(process.cwd(), "src/lib/data/rows.ts"), "utf8");
    expect(rows).toContain("grossManual: !!r.gross_manual");
    const form = readFileSync(join(process.cwd(), "src/components/kpi/form-tabel.tsx"), "utf8");
    expect(form).not.toContain("Ayam Goreng Busari");
  });

  it("outlet yang bulan ini sudah punya angka ESB tidak bisa diketik", () => {
    const form = readFileSync(join(process.cwd(), "src/components/kpi/form-tabel.tsx"), "utf8");
    expect(form).toContain('jenis === "gross_manual" && o.dariEsb ?');
    expect(form).toContain("dari ESB");
  });

  it("satu outlet yang angkanya belum ada menahan totalnya, bukan tampil kurang", () => {
    // Total yang kurang akan menyeret target bulan berikutnya ikut salah,
    // karena target dihitung dari rata-rata tiga bulan sebelumnya.
    expect(data).toContain("grossPerOutlet.some((v) => v === null)");
  });
});

describe('pilihan "Semua"', () => {
  it("menggabungkan penugasan seluruh CA tanpa terhitung dua kali", () => {
    // Penugasan outlet tidak pernah bertumpuk — User Management menyembunyikan
    // outlet yang sudah dipegang koordinator lain.
    expect(data).toContain("gabungan ? semuaPic.map((o) => o.value) : [pic]");
  });

  it("hanya menghitung CA yang benar-benar memegang outlet", () => {
    // Menyertakan yang belum ditugaskan menaikkan target per orang tanpa
    // menambah satu pun outlet yang dinilai.
    expect(data).toContain("(getUser(o.value)?.outletIds ?? []).length > 0");
  });

  it("target per orang dikalikan jumlah orang yang tercakup", () => {
    // Gabungan delapan Coordinator Area dibandingkan dengan target satu orang
    // akan selalu terlihat jauh melampaui atau jauh gagal.
    expect(data).toContain('const perOrang = i.key === "hygiene_cctv" || i.key === "komplain_area"');
    expect(data).toContain("target * pengali");
  });

  it("hanya untuk membaca — tidak bisa dipakai menyimpan", () => {
    expect(papan).toContain("laporan.pic !== SEMUA_PIC");
    expect(halaman).toContain("Semua Coordinator Area");
  });
});

describe("HPP se-area", () => {
  it("total harga pokok dibagi total penjualan, bukan rata-rata persen", () => {
    // Merata-ratakan persen membuat outlet terkecil sama beratnya dengan
    // outlet terbesar, dan angkanya tidak pernah cocok dengan laporan keuangan.
    expect(data).toContain("(totalHpp / totalGrossHpp) * 100");
  });

  it("yang diisi NOMINAL, persennya dihitung", () => {
    // Persen yang diketik tidak bisa diperiksa ulang terhadap apa pun: 37,5
    // yang sebenarnya 41 tidak akan pernah dibantah data mana pun.
    expect(data).toContain("hppNominal");
    const form = readFileSync(join(process.cwd(), "src/components/kpi/form-tabel.tsx"), "utf8");
    expect(form).toContain("function persenTerhadap");
    expect(form).toContain("% thd Gross");
  });
});

describe("satu pintu masuk", () => {
  it("tombol Input hanya muncul bila ada yang belum tercakup form tabel", () => {
    // Dua pintu ke tujuan yang sama membuat orang bertanya-tanya mana yang
    // benar, dan angka yang sama bisa masuk dua kali lewat jalan berbeda.
    expect(papan).toContain('bentukIsian(i) !== "otomatis" && bentukIsian(i) !== "kegiatan"');
    expect(papan).toContain("perluDialogInput &&");
  });

  it("angka bulanan per outlet ikut di dalam form yang sama", () => {
    expect(papan).toContain('out.push({ jenis: "net_profit"');
    expect(papan).toContain('out.push({ jenis: "hpp"');
    expect(papan).toContain('jenis: "gross_manual"');
  });
});

describe("bulan pembanding yang belum ditarik", () => {
  it("dibedakan dari outlet yang memang baru", () => {
    // Kejadian nyata: menilai Agustus membutuhkan Mei, dan penarikan bulanan
    // hanya menjangkau tiga bulan — jadi SELURUH outlet terbaca "belum genap 3
    // bulan" pada bulan mana pun selain yang terbaru. Pesannya menyalahkan
    // outletnya, padahal yang kurang datanya.
    expect(data).toContain("const bulanKosong = bulanLalu.filter(");
    expect(data).toContain("ca.bulanKosong.length > 0");
    const form = readFileSync(join(process.cwd(), "src/components/kpi/form-tabel.tsx"), "utf8");
    expect(form).toContain("angka ESB bulan pembanding belum ditarik");
  });

  it("penarikan bulanan menjangkau dua belas bulan, bukan tiga", () => {
    // Tiga bulan hanya cukup untuk menilai bulan berjalan.
    const rute = readFileSync(join(process.cwd(), "src/app/api/cron/fraud-sync/route.ts"), "utf8");
    expect(rute).toContain('searchParams.get("mundur") ?? "12"');
  });
});

describe("nol dari ESB", () => {
  it("dibaca sebagai 'belum ada di bulan itu', bukan penjualan nol", () => {
    // ESB tetap membalas untuk cabang yang belum buka, dan balasannya nol —
    // barisnya selalu tersimpan. Kalau nol dianggap angka yang sah: outlet yang
    // belum buka LOLOS aturan tiga bulan dengan penjualan nol dan menyeret
    // rata-rata seluruh area ke bawah. Empat sampai tiga belas cabang bernilai
    // nol pada tiap bulan yang sudah ditarik — ini bukan kemungkinan teoretis.
    expect(data).toContain("if (dariEsb !== undefined && dariEsb > 0) return dariEsb;");
    expect(data).toContain("const berjalan = (nilai: number | null): boolean => nilai !== null && nilai > 0;");
    expect(data).toContain("if (!tiga.every(berjalan))");
  });

  it("nol dari ESB tidak menutup jalan isian tangan", () => {
    // Justru tiga outlet pindahan Majoo yang bernilai nol — riwayatnya tidak
    // ikut terbawa. Kalau nol dianggap "sudah ada di ESB", kolom isiannya
    // hilang dan tidak ada cara memperbaikinya sama sekali.
    expect(data).toContain("(esbIni.get(o.branch)?.net ?? 0) > 0");
  });
});

describe("rentang tiga bulan sama di seluruh modul", () => {
  it("Efisiensi Beban juga memakai tiga bulan SEBELUMNYA, bukan termasuk bulan berjalan", () => {
    // Dua rumus untuk satu istilah yang sama membuat dua halaman menampilkan
    // "rata-rata 3 bulan" yang berbeda, dan yang membacanya menyimpulkan salah
    // satunya rusak. Untuk Juli yang dipakai April, Mei, Juni.
    const blok = data.slice(data.indexOf("async function averageTigaBulan"));
    expect(blok.slice(0, blok.indexOf("\n}"))).toContain("const bulan = tigaBulanSebelum(periode);");
  });

  it("rata-ratanya bisa diperiksa sendiri per outlet di layar", () => {
    // Angka yang tidak bisa ditelusuri hanya bisa dipercaya atau ditolak
    // seluruhnya — tidak ada jalan tengah untuk memeriksanya.
    const form = readFileSync(join(process.cwd(), "src/components/kpi/form-tabel.tsx"), "utf8");
    expect(form).toContain("Average 3 Bln");
    expect(data).toContain("average: rata.get(o.id) ?? null");
  });
});


describe("dari mana outlet Coordinator Area diambil", () => {
  it("dari PENUGASANNYA, bukan dari area outlet", () => {
    // Kejadian nyata: diambil dari `outlets.area_id`, dan hasilnya salah untuk
    // hampir semua orang — Wika mendapat sepuluh outlet "Belum Ditentukan"
    // alih-alih sebelas outlet yang dipegangnya, Reynaldi mendapat sebelas
    // outlet Area Poetri padahal ditugaskan dua.
    //
    // Yang membuatnya berbahaya: daftarnya tetap masuk akal di layar — nama
    // outlet sungguhan, angka penjualan sungguhan. Tidak ada satu pun tanda
    // bahwa yang dinilai bukan outlet orang itu.
    const blok = data.slice(data.indexOf("function outletCa("));
    const badan = blok.slice(0, blok.indexOf("\n}"));
    expect(badan).toContain("getUser(p)?.outletIds ?? []");
    expect(badan).not.toContain("areaId");
  });

  it("penjagaan simpannya memakai sumber yang sama", () => {
    // Dua sumber untuk satu pertanyaan berarti suatu saat yang boleh dibaca
    // dan yang boleh ditulis berbeda isinya.
    expect(data).toContain("export function outletMilikPic(pic: string): Set<string> {\n  return new Set(outletCa([pic]).map((o) => o.id));");
  });
});


describe("lembar Excel angka per outlet", () => {
  const lembar = readFileSync(join(process.cwd(), "src/components/kpi/lembar-outlet.ts"), "utf8");
  const form = readFileSync(join(process.cwd(), "src/components/kpi/form-tabel.tsx"), "utf8");

  it("satu format untuk Net Profit dan Harga Pokok sekaligus", () => {
    // Dua format terpisah berarti dua kali unduh-unggah dan dua kesempatan
    // tertukar berkas — padahal keduanya diisi orang yang sama, untuk outlet
    // yang sama, pada bulan yang sama.
    expect(lembar).toContain('"Net Profit (Rp)", "Harga Pokok Penjualan (Rp)"');
  });

  it("dicocokkan lewat ID outlet, bukan namanya", () => {
    // Mencocokkan lewat nama gagal diam-diam begitu ada outlet berganti nama
    // atau dua nama yang mirip — dan yang gagal tidak mengeluh, ia hanya tidak
    // tersimpan.
    expect(lembar).toContain('"ID Outlet"');
    expect(lembar).toContain("dikenal.has(id)");
  });

  it("baris yang tidak dikenal disebut, tidak dibuang diam-diam", () => {
    expect(lembar).toContain("asing.push(nama || id)");
    expect(form).toContain("tidak dikenali dan dilewati");
  });

  it("sekali simpan menulis kedua angka, bukan hanya yang sedang dilihat", () => {
    // Sekali unggah mengisi keduanya; menyimpan salah satunya saja membuang
    // separuh pekerjaan tanpa memberi tahu.
    expect(form).toContain("ubahan.netProfit = npBaru");
    expect(form).toContain("ubahan.hppNominal = hppBaru");
  });
});

describe('mengisi sambil melihat "Semua"', () => {
  const form = readFileSync(join(process.cwd(), "src/components/kpi/form-tabel.tsx"), "utf8");

  it("angka per outlet boleh disimpan, catatan kegiatan tidak", () => {
    // Angka per outlet menempel pada outlet dan bulan; catatan kegiatan
    // menempel pada orang, dan saat "Semua" dipilih tidak ada orangnya.
    expect(aksiKpi).toContain("izinkanGabungan: gabungan");
    expect(aksiKpi).toContain("outletSeluruhPic(input.posisi)");
    expect(form).toContain("bolehKegiatan ? opsi : opsi.filter(");
  });
});


describe("angka ESB sebelum outletnya pindah ke ESB", () => {
  it("diabaikan sepenuhnya, bukan dipakai", () => {
    // Ini yang paling berbahaya dari seluruh modul: angkanya BUKAN nol dan
    // BUKAN kosong. Ayam Goreng Busari Siantan tercatat Rp 186 juta pada
    // Januari, Rp 225 juta pada Maret — padahal outletnya baru masuk ESB
    // Agustus. Tidak ada satu pun tanda bahwa angka itu salah: ia lolos aturan
    // tiga bulan, jadi dasar target bulan berikutnya, dan terhitung sebagai
    // capaian untuk penjualan yang tidak pernah ada.
    expect(data).toContain("if (o.esbMulai && periode < o.esbMulai) return tangan.get(o.id)?.gross ?? null;");
  });

  it("bulan sebelum itu tetap bisa diisi tangan", () => {
    // Kalau ESB palsu dianggap "sudah ada", kolom isiannya terkunci dan angka
    // yang benar tidak punya jalan masuk sama sekali.
    expect(data).toContain("!(o.esbMulai && periode < o.esbMulai) &&");
  });

  it("batasnya per outlet dan berupa data, bukan tanggal di dalam kode", () => {
    const rows = readFileSync(join(process.cwd(), "src/lib/data/rows.ts"), "utf8");
    expect(rows).toContain("esbMulai: r.esb_mulai ?? null");
    expect(data).not.toContain("2026-08");
  });
});
