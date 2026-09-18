import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { HARI_JENDELA, tanggalHarian } from "@/lib/data/ops-dashboard";
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
    expect(b).toContain("bulanIniWib()");
    expect(b).toContain("bulanSebelum(m)");
    expect(b).toContain("jumlahHari(bulanIni)");
    expect(b).toContain("hariBerjalan(bulanIni)");
  });

  it("rumus bisnisnya tidak berubah", () => {
    // Yang boleh berubah cuma BULAN MANA yang dihitung — bukan cara menghitungnya.
    expect(b).toContain("const avg3 = (o1 + o2 + o3) / 3");
    expect(b).toContain("const targetMonth = avg3 * 1.15");
    expect(b).toContain("const targetHarian = targetMonth / daysInMonth");
    expect(b).toContain("const ratePerDay = daysElapsed > 0 ? realisasi / daysElapsed : 0");
    expect(b).toContain("proyeksiBulanan: ratePerDay * daysInMonth");
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
