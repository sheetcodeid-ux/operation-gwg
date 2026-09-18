import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { HARI_JENDELA, angkaTarget, hariWajibBulan, rataTigaBulan, statusBulan, tanggalHarian, type OmzetBulan } from "@/lib/data/ops-dashboard";
import { geserHari, selisihHari } from "@/lib/ops/waktu";

/**
 * KONTRAK AKTIVITAS & TANGGAL OPERASIONAL `/analytics`.
 *
 * `loadActivity` dan `loadControl` tidak diekspor, dan `getOpsDashboard`
 * menuntut basis data — jadi keduanya tidak bisa dijalankan di sini. Yang
 * dijaga dibaca dari kode sumbernya, pola yang sudah dipakai
 * `signals.test.ts` dan `mingguan-performa.test.ts`.
 *
 * Dua kalimat yang dijaga:
 *
 *   1. "HARI INI" adalah hari kalender Jakarta, bukan jam server. Di server UTC
 *      selisihnya tujuh jam, dan selama tujuh jam itu setiap outlet yang sudah
 *      mengisi checklist untuk hari yang benar terhitung belum.
 *
 *   2. Layar hanya menyatakan yang dibuktikan datanya. Ketiadaan baris hygiene
 *      membuktikan tidak ada catatannya — bukan membuktikan siapa yang lalai.
 */

const SRC = "src/lib/data/ops-dashboard.ts";
const src = readFileSync(new URL(`../../../${SRC}`, import.meta.url), "utf8");
/** Tanpa komentar: larangan tidak boleh tertangkap dari kalimat yang menjelaskannya. */
const kode = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

/**
 * Badan `angkaTarget`, diiris sampai fungsi berikutnya.
 *
 * `badan()` berhenti pada "\n}" pertama, dan tanda tangan fungsi ini memuat
 * objek parameter yang barisnya diawali "}" — jadi irisannya akan berhenti di
 * tanda tangannya sendiri.
 */
const badanAngkaTarget = (): string => {
  const i = kode.indexOf("export function angkaTarget");
  const j = kode.indexOf("async function loadTarget");
  expect(i, "angkaTarget tidak ditemukan").toBeGreaterThan(-1);
  expect(j, "loadTarget tidak ditemukan").toBeGreaterThan(i);
  return kode.slice(i, j);
};

const badan = (nama: string): string => {
  const i = kode.indexOf(`function ${nama}(`);
  expect(i, `${nama} tidak ditemukan`).toBeGreaterThan(-1);
  const sisa = kode.slice(i);
  const j = sisa.indexOf("\n}");
  return sisa.slice(0, j === -1 ? undefined : j);
};

describe("tanggal operasional = WIB", () => {
  it("helper existing yang dipakai, bukan implementasi zona waktu baru", () => {
    expect(kode).toMatch(/^import \{[^}]*\bhariIniWib\b[^}]*\} from "@\/lib\/ops\/waktu";$/m);
  });

  it("loadActivity memakai hariIniWib(), bukan jam server", () => {
    const b = badan("loadActivity");
    expect(b).toContain("hariIniWib()");
    expect(b).not.toMatch(/ymd\(new Date\(\)\)/);
  });

  it("loadControl memakai hariIniWib() — diselaraskan, bukan separuh", () => {
    const b = badan("loadControl");
    expect(b).toContain("hariIniWib()");
    expect(b).not.toMatch(/ymd\(new Date\(\)\)/);
  });

  it("keduanya memakai definisi 'hari ini' yang SAMA", () => {
    // Satu hari operasional untuk satu halaman. Kalau `checkedToday` di panel
    // Kontrol dan daftar aktivitas memakai tanggal berbeda, keduanya bisa
    // saling membantah di layar yang sama.
    for (const f of ["loadActivity", "loadControl"]) {
      expect(badan(f).match(/hariIniWib\(\)/g) ?? [], f).toHaveLength(1);
    }
  });

  it("tidak ada salinan baru rumus pergeseran WIB", () => {
    expect(kode).not.toMatch(/7\s*\*\s*3_?600_?000/);
    expect(kode).not.toMatch(/25_?200_?000/);
  });
});

describe("aktivitas outlet hanya menyatakan yang dibuktikan datanya", () => {
  const b = badan("loadActivity");

  it("tidak menuduh aktor mana pun", () => {
    // Tidak ada `submitted_by`, `submitted_at`, maupun id pengguna di
    // `HygieneAudit`; `inspectorName`/`supervisorName` teks bebas. Jadi "SPV"
    // tidak pernah dibuktikan barisnya.
    for (const pola of [/SPV/i, /supervisor/i]) {
      expect(b, String(pola)).not.toMatch(pola);
    }
  });

  it("tidak mengklaim peristiwa unggah", () => {
    // `date` DIISI PENGGUNA dan berarti tanggal yang DIPERIKSA, bukan waktu
    // pengiriman — jadi "belum upload" menyimpulkan lebih dari yang terukur.
    for (const pola of [/upload/i, /unggah/i]) {
      expect(b, String(pola)).not.toMatch(pola);
    }
  });

  it("kalimatnya menyebut ketiadaan catatan, bukan kelalaian orang", () => {
    expect(b).toContain("Belum ada catatan hygiene untuk tanggal ini");
  });

  it("buktinya tetap ketiadaan baris hygiene pada tanggal itu", () => {
    // Semantiknya TIDAK diubah — hanya kalimatnya yang berhenti menyimpulkan.
    expect(b).toContain("listHygiene(user)");
    expect(b).toContain("!checked.has(o.id)");
  });

  it("komplain tetap fakta langsung dari barisnya", () => {
    expect(b).toContain("Komplain baru:");
    expect(b).toContain('c.status === "open"');
  });
});

describe("missing tidak menjadi nol di lapisan data /analytics", () => {
  it("tidak ada `?? 0` maupun `|| 0` pada angka bisnis", () => {
    const aman = ["evMap.get(e.name) ?? 0"]; // akumulator penghitung event
    let bersih = kode;
    for (const a of aman) bersih = bersih.replace(a, "");
    expect(bersih).not.toMatch(/\?\?\s*0\b/);
    expect(bersih).not.toMatch(/\|\|\s*0\b/);
  });

  it("net sales hari ini boleh tidak diketahui", () => {
    expect(kode).toContain("netSales: number | null");
    expect(kode).toContain("byDay.get(dToday) ?? null");
  });

  it("pembelian & beban per cabang boleh tidak diketahui", () => {
    expect(kode).toContain("pembelianCur: pcm.get(o.code) ?? null");
    expect(kode).toContain("bebanPrev: epm.get(o.code) ?? null");
  });
});

/**
 * BATAS TENGAH MALAM TANGGAL HARIAN.
 *
 * `tanggalHarian` murni dan menerima `pada`, jadi batasnya bisa diuji tanpa
 * menyentuh jam mesin. Yang diperiksa bukan "fungsinya jalan", melainkan tujuh
 * jam yang dulu salah: antara 17.00 dan 24.00 UTC, WIB sudah berganti hari
 * sementara jam server belum. Di jendela itulah kartu KPI dulu menampilkan
 * penjualan kemarin sehari penuh sebagai angka hari ini.
 */
describe("tanggalHarian — batas hari WIB", () => {
  // 2026-09-17 di UTC. Tanggal WIB-nya bergantung jamnya, dan itu intinya.
  const utc = (jam: string) => Date.parse(`2026-09-17T${jam}:00Z`);

  it("T-01 · 23.30 UTC → 06.30 WIB keesokan harinya", () => {
    expect(tanggalHarian(utc("23:30")).dToday).toBe("2026-09-18");
  });

  it("T-02 · 18.30 UTC → 01.30 WIB keesokan harinya — batas yang dulu salah", () => {
    // Jam server masih 17 September; WIB sudah 18 September. Dulu yang terbaca
    // tanggal server, jadi "hari ini" menunjuk hari yang sudah lewat di
    // Jakarta — dan barisnya sudah terisi penuh oleh cron, sehingga layar
    // menampilkan angka sehari penuh dengan lencana live.
    expect(tanggalHarian(utc("18:30")).dToday).toBe("2026-09-18");
  });

  it("T-03 · 16.30 UTC → 23.30 WIB di hari yang sama", () => {
    expect(tanggalHarian(utc("16:30")).dToday).toBe("2026-09-17");
  });

  it("T-03b · tepat di tengah malam WIB, bukan sedetik sebelum atau sesudahnya", () => {
    expect(tanggalHarian(Date.parse("2026-09-17T16:59:59Z")).dToday).toBe("2026-09-17");
    expect(tanggalHarian(Date.parse("2026-09-17T17:00:00Z")).dToday).toBe("2026-09-18");
  });

  it("T-04 · kemarin = dToday − 1 hari kalender", () => {
    const t = tanggalHarian(utc("18:30"));
    expect(t.dYest).toBe("2026-09-17");
    expect(selisihHari(t.dYest, t.dToday)).toBe(1);
  });

  it("T-04b · kemarin menyeberangi pergantian bulan", () => {
    // 2026-08-31T17:00Z = 2026-09-01 00.00 WIB.
    const t = tanggalHarian(Date.parse("2026-08-31T17:00:00Z"));
    expect(t.dToday).toBe("2026-09-01");
    expect(t.dYest).toBe("2026-08-31");
  });

  it("T-05 · jendela tren = 14 tanggal, dFrom = dToday − 13", () => {
    const t = tanggalHarian(utc("18:30"));
    expect(t.dFrom).toBe("2026-09-05");
    expect(selisihHari(t.dFrom, t.dToday)).toBe(HARI_JENDELA - 1);

    // Dihitung ulang dari ujung ke ujung: inklusif di kedua sisi.
    const tanggal: string[] = [];
    for (let d = t.dFrom; d <= t.dToday; d = geserHari(d, 1)) tanggal.push(d);
    expect(tanggal).toHaveLength(HARI_JENDELA);
    expect(tanggal[0]).toBe(t.dFrom);
    expect(tanggal.at(-1)).toBe(t.dToday);
  });

  it("T-06 · opts.date dipakai apa adanya, tidak digeser zona waktu server", () => {
    // Tanggal yang diminta pemanggil sudah berupa tanggal bisnis. Memutarnya
    // lewat `new Date()` lalu membacanya dengan getter lokal adalah persis cara
    // "2026-09-17" dulu bisa keluar sebagai 2026-09-16.
    for (const jam of ["00:30", "16:30", "18:30", "23:30"]) {
      const t = tanggalHarian(utc(jam), "2026-09-17");
      expect(t.dToday, jam).toBe("2026-09-17");
      expect(t.dYest, jam).toBe("2026-09-16");
      expect(t.dFrom, jam).toBe("2026-09-04");
    }
  });

  it("T-06b · bentuk tanggal yang tidak sah jatuh ke hari WIB, bukan ke tanggal karangan", () => {
    for (const buruk of ["", "17-09-2026", "2026-9-7", "besok"]) {
      expect(tanggalHarian(utc("18:30"), buruk).dToday, buruk).toBe("2026-09-18");
    }
  });

  it("tanpa argumen tetap memberi hari WIB berjalan", () => {
    expect(tanggalHarian().dToday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("getOpsDashboard memakai turunan tanggal itu, bukan salinannya sendiri", () => {
    expect(kode).toContain("tanggalHarian(Date.now(), opts.date)");
    // Turunan harian tidak boleh lagi lewat objek `Date`: di situlah getter
    // lokal masuk. Cakupannya sengaja badan `tanggalHarian` saja — turunan
    // BULANAN (`ym(...)`) punya batasnya sendiri dan bukan urusan gerbang ini.
    const b = badan("tanggalHarian");
    expect(b).not.toMatch(/new Date\(/);
    expect(b).not.toMatch(/86_?400_?000/);
    expect(kode).not.toMatch(/const ymd =/);
  });
});

/**
 * BATAS BULAN BISNIS (U-A).
 *
 * Gate V membereskan HARI; bulannya masih dibaca dari jam server lewat
 * `ym(new Date())`. Di server UTC, tujuh jam pertama setiap tanggal 1 WIB
 * masih terbaca bulan sebelumnya — dan itu tidak tampak seperti kesalahan di
 * layar: `realisasi` menampilkan omzet bulan lalu sebagai bulan berjalan,
 * `avg3` bergeser satu bulan, Finance dan Pembelian per cabang membaca periode
 * yang sudah ditutup, dan capaiannya tetap terlihat wajar.
 *
 * Bulan sekarang diturunkan DARI `dToday`, jadi hari dan bulan pada satu
 * halaman tidak mungkin berasal dari dua kalender yang berbeda.
 */
describe("bulan bisnis mengikuti kalender WIB", () => {
  const pada = (iso: string) => Date.parse(iso);

  it("UA-01 · 16.59.59 UTC masih 17 September WIB — bulan September", () => {
    const t = tanggalHarian(pada("2026-09-17T16:59:59Z"));
    expect(t.dToday).toBe("2026-09-17");
    expect(t.bulan).toBe("2026-09");
  });

  it("UA-02 · akhir bulan UTC yang sudah awal bulan WIB", () => {
    // 2026-08-31 17.00Z = 2026-09-01 00.00 WIB. Jam server masih Agustus;
    // kalender bisnis sudah September.
    const t = tanggalHarian(pada("2026-08-31T17:00:00Z"));
    expect(t.dToday).toBe("2026-09-01");
    expect(t.bulan).toBe("2026-09");
  });

  it("UA-03 · sedetik sebelumnya masih Agustus", () => {
    const t = tanggalHarian(pada("2026-08-31T16:59:59Z"));
    expect(t.dToday).toBe("2026-08-31");
    expect(t.bulan).toBe("2026-08");
  });

  it("UA-04 · tengah malam WIB di pergantian tahun", () => {
    // Yang bergeser bukan cuma bulannya, tapi tahunnya.
    expect(tanggalHarian(pada("2026-12-31T16:59:59Z")).bulan).toBe("2026-12");
    expect(tanggalHarian(pada("2026-12-31T17:00:00Z")).bulan).toBe("2027-01");
  });

  it("UA-05 · opts.date eksplisit menentukan bulannya juga", () => {
    // Jam server masih 31 Agustus; yang diminta 1 September. Yang dipakai
    // tanggal yang diminta, berikut bulannya.
    const t = tanggalHarian(pada("2026-08-31T10:00:00Z"), "2026-09-01");
    expect(t.dToday).toBe("2026-09-01");
    expect(t.bulan).toBe("2026-09");
    expect(tanggalHarian(pada("2026-09-17T23:30:00Z"), "2026-09-18").bulan).toBe("2026-09");
  });

  it("UA-06 · tanggal biasa tetap di bulan yang sama", () => {
    for (const jam of ["00:30", "06:00", "12:00", "16:30", "18:30", "23:30"]) {
      expect(tanggalHarian(pada(`2026-09-10T${jam}:00Z`)).bulan, jam).toBe("2026-09");
    }
  });

  it("bulan SELALU milik dToday — tidak pernah dibaca ulang dari jam server", () => {
    const contoh = [
      "2026-01-31T17:00:00Z",
      "2026-02-28T16:59:59Z",
      "2026-02-28T17:00:00Z",
      "2024-02-29T17:00:00Z",
      "2026-06-30T18:45:00Z",
      "2026-11-30T23:59:59Z",
    ];
    for (const iso of contoh) {
      const t = tanggalHarian(pada(iso));
      expect(t.bulan, iso).toBe(t.dToday.slice(0, 7));
    }
  });
});

describe("loadTarget memakai bulan bisnis, bukan bulan server", () => {
  // `loadTarget` tidak diekspor dan menuntut basis data, jadi yang dijaga
  // sumbernya — pola yang sama dengan penjagaan aktivitas di atas.
  const b = badan("loadTarget");

  it("tidak ada lagi jam lokal server di dalamnya", () => {
    expect(b).not.toMatch(/new Date\(/);
    expect(b).not.toMatch(/getFullYear\(\)|getMonth\(\)|getDate\(\)/);
  });

  it("memakai helper WIB yang sudah ada, bukan rumus baru", () => {
    // Bulan rujukan diputuskan di `loadTarget`; jumlah hari dan hari berjalan
    // dipakai `angkaTarget` sejak angkanya dipisah supaya bisa diuji.
    expect(b).toContain("bulanIniWib()");
    expect(b).toContain("bulanSebelum(m)");
    const t = badanAngkaTarget();
    expect(t).toContain("jumlahHari(bulanIni)");
    expect(t).toContain("hariBerjalan(bulanIni");
  });

  it("rumus bisnisnya tidak berubah", () => {
    // Yang boleh berubah cuma BULAN MANA yang dihitung — bukan cara menghitungnya.
    // Sejak S-A-04 rata-ratanya pindah ke `rataTigaBulan`, dan rumusnya tetap
    // jumlah dibagi tiga: dijaga di sini pada tempat barunya, dan diuji
    // angkanya pada blok "avg3 hanya lahir dari tiga bulan utuh".
    expect(badan("rataTigaBulan")).toContain("bulan.reduce((a, b) => a + b.nilai, 0) / 3");
    expect(b).toContain("const avg3 = rataTigaBulan([o1, o2, o3]);");
    const t = badanAngkaTarget();
    expect(t).toContain("const targetMonth = avg3 * 1.15;");
    expect(t).toContain("const targetHarian = targetMonth / daysInMonth;");
    expect(t).toContain("realisasi / daysElapsed");
    expect(t).toContain("ratePerDay * daysInMonth");
    // S-A-04 tetap terbuka: tidak ada ambang kelengkapan yang dikarang.
    expect(b).not.toMatch(/0\.9|0\.95|90\s*%|95\s*%|kelengkapan|threshold/i);
  });
});

describe("getOpsDashboard: hari dan bulan dari satu turunan", () => {
  it("bulan diambil dari tanggalHarian, tidak dihitung sendiri", () => {
    expect(kode).toContain("const { dToday, dYest, dFrom, bulan: month } = tanggalHarian(Date.now(), opts.date);");
    expect(kode).not.toMatch(/ym\(opts\.date/);
    expect(kode).not.toMatch(/ym\(new Date\(\)\)/);
  });

  it("satu-satunya sisa `ym` adalah bulan sebelum milik loadBranchPerf", () => {
    // Baris itu menurunkan bulan dari STRING bulan, bukan dari jam server:
    // dibangun dan dibaca pada zona yang sama, jadi hasilnya identik di zona
    // mana pun. Bukan bagian U-A, dan tidak disentuh.
    expect(kode.match(/\bym\(/g) ?? []).toHaveLength(1); // tinggal satu pemanggil
    expect(kode).toContain("const ym = (d: Date) =>"); // definisinya masih dipakai baris itu
    expect(badan("loadBranchPerf")).toContain("const prev = ym(new Date(Number(month.slice(0, 4))");
  });
});

/**
 * KELENGKAPAN BULAN (S-A-04).
 *
 * `sales_daily` satu baris per tanggal, isinya total seluruh cabang hari itu.
 * Tanggal yang barisnya belum ada tidak menyumbang apa pun ke penjumlahan —
 * dan dulu hasilnya tetap keluar sebagai angka, tanpa satu tanda pun bahwa
 * bulannya baru separuh. Bulan yang sama sekali kosong bahkan menghasilkan 0,
 * dan nol itu ikut dirata-ratakan sebagai fakta.
 *
 * Yang dijaga di sini: ketersediaan dan nilai adalah dua hal berbeda, dan
 * target hanya boleh lahir dari tiga bulan yang benar-benar utuh.
 */
const bulan = (periode: string, nilai: number, hariAda: number, hariWajib: number): OmzetBulan => ({
  periode,
  nilai,
  hariAda,
  hariWajib,
  status: statusBulan(hariAda, hariWajib),
  berjalan: false,
});

describe("status kelengkapan bulan", () => {
  it("bulan historis penuh → lengkap", () => {
    expect(statusBulan(31, 31)).toBe("lengkap");
    expect(statusBulan(30, 30)).toBe("lengkap");
    expect(statusBulan(28, 28)).toBe("lengkap");
  });

  it("satu hari saja hilang → tidak lengkap, tanpa toleransi", () => {
    // 30/31 = 96,8% — di atas usul ambang 95% yang pernah beredar, dan tetap
    // TIDAK lengkap: kontrak S-A-04 tidak punya ambang.
    expect(statusBulan(30, 31)).toBe("tidak_lengkap");
    expect(statusBulan(8, 31)).toBe("tidak_lengkap");
    expect(statusBulan(29, 30)).toBe("tidak_lengkap");
  });

  it("tidak ada satu baris pun → tidak tersedia, bukan nol jualan", () => {
    expect(statusBulan(0, 31)).toBe("tidak_tersedia");
    expect(statusBulan(0, 30)).toBe("tidak_tersedia");
  });

  it("bulan yang belum datang tidak bisa dinyatakan lengkap", () => {
    // `wajib = 0` di sini berarti tidak ada bukti sama sekali — bukan "tidak
    // ada yang perlu dihitung". Bulan tanpa bukti tidak boleh ikut avg3.
    expect(statusBulan(0, 0)).toBe("tidak_tersedia");
  });
});

describe("hari yang wajib ada", () => {
  // 2026-09-18 05.00 WIB — tanggal 18 sedang berjalan.
  const pada = Date.parse("2026-09-17T22:00:00Z");

  it("bulan yang sudah lewat menuntut seluruh hari kalendernya", () => {
    expect(hariWajibBulan("2026-08", pada)).toBe(31);
    expect(hariWajibBulan("2026-06", pada)).toBe(30);
    expect(hariWajibBulan("2026-02", pada)).toBe(28);
    expect(hariWajibBulan("2024-02", pada)).toBe(29);
  });

  it("bulan berjalan hanya menuntut hari yang SUDAH lewat", () => {
    // 18 September, bukan 30. Menuntut tanggal yang belum terjadi membuat
    // setiap bulan berjalan selamanya terbaca tidak lengkap.
    expect(hariWajibBulan("2026-09", pada)).toBe(18);
  });

  it("bulan yang belum datang tidak menuntut apa pun", () => {
    expect(hariWajibBulan("2026-10", pada)).toBe(0);
    expect(hariWajibBulan("2027-01", pada)).toBe(0);
  });

  it("batas WIB menentukan bulan berjalan yang mana", () => {
    // 2026-08-31T17:00Z = 1 September 00.00 WIB → September baru berjalan
    // satu hari, dan Agustus sudah menjadi bulan lewat yang penuh.
    const awalSeptember = Date.parse("2026-08-31T17:00:00Z");
    expect(hariWajibBulan("2026-09", awalSeptember)).toBe(1);
    expect(hariWajibBulan("2026-08", awalSeptember)).toBe(31);
    // Sedetik sebelumnya masih 31 Agustus WIB.
    const akhirAgustus = Date.parse("2026-08-31T16:59:59Z");
    expect(hariWajibBulan("2026-08", akhirAgustus)).toBe(31);
    expect(hariWajibBulan("2026-09", akhirAgustus)).toBe(0);
  });
});

describe("bulan berjalan: lengkap SAMPAI HARI INI", () => {
  const pada = Date.parse("2026-09-17T22:00:00Z"); // 18 Sep 05.00 WIB

  it("18 hari berjalan, 18 hari ada → lengkap", () => {
    expect(statusBulan(18, hariWajibBulan("2026-09", pada))).toBe("lengkap");
  });

  it("18 hari berjalan, 17 hari ada → tidak lengkap", () => {
    expect(statusBulan(17, hariWajibBulan("2026-09", pada))).toBe("tidak_lengkap");
  });
});

describe("nol yang tercatat bukan hari yang hilang", () => {
  it("hari ber-net 0 tetap terhitung ada, dan omzetnya tetap 0", () => {
    // `sales_daily.net_sales` NOT NULL DEFAULT 0: barisnya ada berarti harinya
    // terukur. Outlet libur sehari bukan hari yang datanya belum ditarik.
    const b = bulan("2026-06", 0, 30, 30);
    expect(b.status).toBe("lengkap");
    expect(b.nilai).toBe(0);
    expect(rataTigaBulan([b, b, b])).toBe(0);
  });

  it("bulan lengkap bernilai nol berbeda dari bulan tanpa data", () => {
    expect(bulan("2026-06", 0, 30, 30).status).toBe("lengkap");
    expect(bulan("2026-06", 0, 0, 30).status).toBe("tidak_tersedia");
  });
});

describe("avg3 hanya lahir dari tiga bulan utuh", () => {
  const juni = bulan("2026-06", 13_624_759_649, 30, 30);
  const juli = bulan("2026-07", 13_527_426_141, 31, 31);
  const agustus = bulan("2026-08", 13_325_523_600, 31, 31);

  it("tiga bulan lengkap → angka, rumusnya tetap jumlah dibagi tiga", () => {
    const avg3 = rataTigaBulan([agustus, juli, juni]);
    expect(avg3).toBe((13_325_523_600 + 13_527_426_141 + 13_624_759_649) / 3);
  });

  it("dua lengkap + satu tidak lengkap → null", () => {
    // Mei 2026 di produksi: 8 dari 31 hari. Dulu delapan hari itu ikut
    // dirata-ratakan sebagai sebulan penuh dan target ikut turun.
    const mei = bulan("2026-05", 3_422_465_957, 8, 31);
    expect(mei.status).toBe("tidak_lengkap");
    expect(rataTigaBulan([juli, juni, mei])).toBeNull();
  });

  it("dua lengkap + satu tanpa data → null, bukan sepertiga lebih kecil", () => {
    const april = bulan("2026-04", 0, 0, 30);
    expect(april.status).toBe("tidak_tersedia");
    expect(rataTigaBulan([juni, juli, april])).toBeNull();
    // Yang dulu terjadi: (13,6 + 13,5 + 0) / 3 — target turun sepertiga.
    expect(rataTigaBulan([juni, juli, april])).not.toBe((juni.nilai + juli.nilai + 0) / 3);
  });

  it("bulan yang hilang tidak diganti nol dan tidak dilewati", () => {
    const april = bulan("2026-04", 0, 0, 30);
    expect(rataTigaBulan([juni, juli, april])).toBeNull();
    // Juga bukan rata-rata dua bulan yang tersisa.
    expect(rataTigaBulan([juni, juli, april])).not.toBe((juni.nilai + juli.nilai) / 2);
  });

  it("menuntut tepat tiga bulan rujukan", () => {
    expect(rataTigaBulan([juni, juli])).toBeNull();
    expect(rataTigaBulan([juni, juli, agustus, agustus])).toBeNull();
    expect(rataTigaBulan([])).toBeNull();
  });
});

describe("target & attainment ikut tidak lahir ketika buktinya kurang", () => {
  const b = badan("loadTarget");

  it("avg3 null → loadTarget berhenti, tidak menghasilkan angka kecil", () => {
    expect(b).toContain("const avg3 = rataTigaBulan([o1, o2, o3]);");
    expect(b).toContain("if (avg3 === null || avg3 <= 0) return null;");
  });

  it("rumus target tidak berubah", () => {
    const t = badanAngkaTarget();
    expect(t).toContain("const targetMonth = avg3 * 1.15;");
    expect(t).toContain("+((realisasi / targetMonth) * 100).toFixed(2)");
    // Attainment hanya dihitung setelah target lahir; ketika target tidak
    // lahir, seluruh panelnya tidak ada — bukan persentase dari target kecil.
    //
    // Sejak S-A-04-A realisasi juga menuntut bulan berjalan yang lengkap:
    // barisnya berpindah ke `angkaTarget` dan bersyarat.
    expect(t).toContain('const realisasi = o0.status === "lengkap" ? o0.nilai : null;');
  });

  it("tidak ada ambang kelengkapan yang dikarang", () => {
    expect(b).not.toMatch(/0\.9\b|0\.95\b|\b9[05]\s*%/);
    const kelengkapan = kode.slice(kode.indexOf("export function statusBulan"));
    expect(kelengkapan.slice(0, 400)).not.toMatch(/0\.9\b|0\.95\b|\b9[05]\b/);
  });

  it("nilai bulan tidak lagi dipakai telanjang sebagai angka", () => {
    // `omzetOfMonth` mengembalikan bukti, bukan cuma angka: pemakainya harus
    // menyebut `.nilai` dan karenanya melewati statusnya.
    expect(kode).toContain("async function omzetOfMonth(month: string, pada: number = Date.now()): Promise<OmzetBulan>");
    expect(kode).not.toMatch(/const avg3 = \(o1 \+ o2 \+ o3\) \/ 3/);
  });
});

/**
 * BULAN BERJALAN YANG BELUM LENGKAP (S-A-04-A).
 *
 * S-A-04 menutup TIGA BULAN RUJUKAN: target tidak lahir dari bulan berlubang.
 * Yang tersisa adalah bulan yang sedang berjalan — dan lubang di sana bergerak
 * ke arah sebaliknya: realisasi lebih kecil, sehingga capaian terbaca lebih
 * rendah, laju harian terbaca lebih lambat (pembilangnya kurang hari,
 * penyebutnya tetap hari kalender), dan proyeksi sebulan mewarisi keduanya.
 *
 * Empat angka itu sekarang ikut tidak lahir. Yang TIDAK ikut: `targetMonth`
 * (buktinya tiga bulan rujukan yang sudah ditutup) dan `todayActual` (buktinya
 * baris hari ini sendiri).
 */
describe("angkaTarget — realisasi bulan berjalan", () => {
  // 18 September 2026, 05.00 WIB: 18 hari sudah berjalan.
  const pada = Date.parse("2026-09-17T22:00:00Z");
  const AGUSTUS = 13_325_523_600;
  const AVG3 = 13_492_569_797;

  const bulanBerjalan = (hariAda: number, nilai: number): OmzetBulan => ({
    periode: "2026-09",
    nilai,
    hariAda,
    hariWajib: 18,
    status: statusBulan(hariAda, 18),
    berjalan: true,
  });
  const agustus: OmzetBulan = {
    periode: "2026-08",
    nilai: AGUSTUS,
    hariAda: 31,
    hariWajib: 31,
    status: "lengkap",
    berjalan: false,
  };
  const hitung = (o0: OmzetBulan, todayActual: number | null = 420_000_000) =>
    angkaTarget({ bulanIni: "2026-09", o0, o1: agustus, avg3: AVG3, todayActual, pada });

  it("1 · bulan berjalan lengkap (18/18) → seluruh angkanya lahir", () => {
    const t = hitung(bulanBerjalan(18, 7_485_463_340));
    expect(t.realisasi).toBe(7_485_463_340);
    expect(t.attainmentPct).toBeCloseTo(48.24, 2);
    expect(t.proyeksiBulanan).toBeCloseTo((7_485_463_340 / 18) * 30, 0);
    expect(t.momPct).toBeCloseTo(-43.8, 1); // rumus MoM TIDAK diubah gate ini
    expect(t.targetMonth).toBe(AVG3 * 1.15);
  });

  it("2 · satu hari hilang (17/18) → realisasi & turunannya tidak lahir", () => {
    const t = hitung(bulanBerjalan(17, 7_000_000_000));
    expect(t.realisasi).toBeNull();
    expect(t.attainmentPct).toBeNull();
    expect(t.momPct).toBeNull();
    expect(t.proyeksiBulanan).toBeNull();
    // Yang salah bukan cuma "kurang" — 7,0 M dari 17 hari akan terbaca sebagai
    // capaian 45% dan proyeksi 12,3 M, dua-duanya lebih rendah dari kenyataan.
    expect(t.attainmentPct).not.toBe(45.12);
  });

  it("3 · belum ada satu hari pun (0/18) → sama, dan bukan Rp 0", () => {
    const t = hitung(bulanBerjalan(0, 0));
    expect(t.realisasi).toBeNull();
    expect(t.realisasi).not.toBe(0);
    expect(t.attainmentPct).toBeNull();
    expect(t.momPct).toBeNull();
    expect(t.proyeksiBulanan).toBeNull();
  });

  it("4 · nol yang SAH tetap nol, bukan null", () => {
    // 18 hari ada, seluruhnya tercatat tidak berjualan. Itu pengukuran.
    const t = hitung(bulanBerjalan(18, 0));
    expect(t.realisasi).toBe(0);
    expect(t.realisasi).not.toBeNull();
    expect(t.attainmentPct).toBe(0);
    expect(t.proyeksiBulanan).toBe(0);
    expect(t.momPct).toBe(-100); // dari nol jualan yang terukur, bukan dari data hilang
  });

  it("5 · target tidak ikut hilang — buktinya bulan lain", () => {
    for (const o0 of [bulanBerjalan(18, 7_485_463_340), bulanBerjalan(17, 7_000_000_000), bulanBerjalan(0, 0)]) {
      const t = hitung(o0);
      expect(t.targetMonth, o0.status).toBe(AVG3 * 1.15);
      expect(t.targetHarian, o0.status).toBe((AVG3 * 1.15) / 30);
    }
  });

  it("6 · todayActual tidak ikut dimatikan oleh bulan yang berlubang", () => {
    expect(hitung(bulanBerjalan(17, 7_000_000_000), 420_000_000).todayActual).toBe(420_000_000);
    expect(hitung(bulanBerjalan(0, 0), 420_000_000).todayActual).toBe(420_000_000);
    // Null-nya tetap datang dari barisnya sendiri, bukan dari kelengkapan bulan.
    expect(hitung(bulanBerjalan(18, 7_485_463_340), null).todayActual).toBeNull();
  });

  it("penyebut laju harian TETAP hari kalender, bukan hari yang ada datanya", () => {
    // Kalau suatu saat penyebutnya diganti `hariAda`, proyeksi bulan berlubang
    // akan kembali lahir — dan terlihat wajar. Itu aturan bisnis baru.
    const b = badanAngkaTarget();
    expect(b).toContain("const daysElapsed = hariBerjalan(bulanIni, pada);");
    expect(b).toContain("realisasi / daysElapsed");
    expect(b).not.toMatch(/hariAda/);
  });

  it("rumusnya tidak berubah — hanya syaratnya yang bertambah", () => {
    const b = badanAngkaTarget();
    expect(b).toContain("const targetMonth = avg3 * 1.15;");
    expect(b).toContain("+((realisasi / targetMonth) * 100).toFixed(2)");
    expect(b).toContain("+(((realisasi - o1.nilai) / o1.nilai) * 100).toFixed(1)");
    expect(b).toContain("ratePerDay * daysInMonth");
    // SA04-A-02 TIDAK dikerjakan di sini: pembandingnya masih bulan penuh.
    expect(b).not.toMatch(/mtd|MTD|sampaiTanggal|prorata/);
  });
});
