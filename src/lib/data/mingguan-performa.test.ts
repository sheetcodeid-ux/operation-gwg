import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * SOURCE GUARD — kontrak yang dijaga dengan membaca kode sumbernya.
 *
 * Kontrak yang cuma ditulis di dokumen akan dilanggar; kontrak yang dijaga uji
 * tidak. Yang dijaga di sini dua kalimat Gate M:
 *
 *   TIDAK ADA WEEKLY TARGET   — tidak ada pembagian target bulanan ke minggu,
 *                               dalam bentuk apa pun
 *   TIDAK ADA WEEKLY SIGNAL   — Signal bulanan tidak pernah dipetakan ke minggu
 *
 * Pola yang sama sudah terbukti di `signals.test.ts`: membaca berkasnya sebagai
 * teks dan gagal begitu bentuk terlarang muncul. Uji perilaku tidak bisa
 * menangkap ini — kode yang membagi target bulanan menghasilkan angka yang
 * benar secara aritmetika, dan hanya salah menurut kontraknya.
 */

const baca = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

/** Buang komentar supaya larangan tidak tertangkap dari kalimat yang menjelaskannya. */
function tanpaKomentar(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

/**
 * Buang isi string dan teks JSX — sisakan ARITMETIKANYA saja.
 *
 * Tanpa ini penjaga pembagi kalender ikut menangkap `bg-muted/30`: Tailwind
 * menulis opasitas dengan garis miring, dan bentuknya persis sama dengan
 * pembagian. Penjaga yang gagal karena warna latar bukan penjaga — ia cuma
 * gangguan yang cepat atau lambat dimatikan orang.
 */
function tanpaTeks(src: string): string {
  return src
    .replace(/`(?:[^`\\]|\\.)*`/g, '""')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, '""')
    .replace(/className=\{[^}]*\}/g, "")
    .replace(/>[^<>{}]+</g, "><");
}

const JALUR_MINGGUAN = [
  "src/lib/ops/mingguan.ts",
  "src/lib/ops/bukti.ts",
  "src/lib/data/mingguan-performa.ts",
  "src/lib/data/signal-baca.ts",
  "src/components/operation/tabel-mingguan.tsx",
  "src/app/(app)/operational/weekly/page.tsx",
];

const KODE = Object.fromEntries(JALUR_MINGGUAN.map((p) => [p, tanpaKomentar(baca(p))]));
/** Hanya aritmetikanya — dipakai penjaga pembagian. */
const RUMUS = Object.fromEntries(JALUR_MINGGUAN.map((p) => [p, tanpaTeks(KODE[p])]));

/* ─────────────────────── CASE 20 — fungsi terlarang ─────────────────────── */

describe("CASE 20 — source guard: fungsi lama tidak boleh masuk jalur Weekly Performance", () => {
  const TERLARANG = ["targetMinggu", "hitungBarisMinggu", "barisHarian", "hitungMinggu", "korporatMinggu", "rincianMinggu", "performaOutlet"];

  for (const p of JALUR_MINGGUAN) {
    for (const f of TERLARANG) {
      it(`${p} tidak memanggil ${f}`, () => {
        expect(KODE[p]).not.toContain(f);
      });
    }
  }

  it("tidak satu pun berkasnya mengimpor dari @/lib/ops/harian", () => {
    for (const p of JALUR_MINGGUAN) expect(KODE[p]).not.toContain("ops/harian");
  });

  it("tidak satu pun berkasnya mengimpor dari @/lib/data/performa-outlet", () => {
    for (const p of JALUR_MINGGUAN) expect(KODE[p]).not.toContain("performa-outlet");
  });

  it("dari @/lib/kpi/minggu HANYA pembagian minggunya yang diambil, bukan mesin targetnya", () => {
    const src = KODE["src/lib/data/mingguan-performa.ts"];
    const impor = /import\s*\{([^}]*)\}\s*from\s*"@\/lib\/kpi\/minggu"/.exec(src);
    expect(impor).not.toBeNull();
    const nama = impor![1].split(",").map((s) => s.replace(/\btype\b/, "").trim()).filter(Boolean);
    expect(nama.sort()).toEqual(["RentangMinggu", "mingguBulan"]);
  });
});

/* ───────────── CASE 21 — pembagian kalender & pembagian target ───────────── */

describe("CASE 21 — source guard: tidak ada pembagian target menjadi angka mingguan", () => {
  it("tidak ada pembagi kalender harfiah di jalur Weekly Performance", () => {
    // 7, 30, 4, 4.33, dan jumlah hari bulan — seluruh bentuk yang pernah dipakai
    // menurunkan target mingguan dari target bulanan.
    const POLA = [/\/\s*7\b/, /\/\s*30\b/, /\/\s*4(\.33)?\b/, /\/\s*daysInMonth/, /\/\s*jumlahHari/, /\/\s*hariBulan/];
    for (const p of JALUR_MINGGUAN) {
      for (const pola of POLA) {
        expect(RUMUS[p], `${p} mengandung ${pola}`).not.toMatch(pola);
      }
    }
  });

  it("target tidak pernah muncul di sisi kiri pembagian mana pun", () => {
    for (const p of JALUR_MINGGUAN) {
      expect(RUMUS[p], p).not.toMatch(/target\w*\s*\/[^/]/i);
      expect(RUMUS[p], p).not.toMatch(/\btarget\w*\s*\*/i);
    }
  });

  it("tidak ada istilah weekly target / achievement / gap dalam bentuk apa pun", () => {
    const POLA = [
      /weekly_?target/i, /target_?mingguan/i, /targetMinggu/,
      /weekly_?achievement/i, /capaian_?mingguan/i,
      /weekly_?gap/i, /gap_?mingguan/i,
    ];
    for (const p of JALUR_MINGGUAN) {
      for (const pola of POLA) expect(KODE[p], `${p} cocok ${pola}`).not.toMatch(pola);
    }
  });

  it("tidak ada weekly signal count dalam bentuk apa pun", () => {
    const POLA = [/weekly_?signal/i, /signal_?mingguan/i, /critical_?signal_?count/i];
    for (const p of JALUR_MINGGUAN) {
      for (const pola of POLA) expect(KODE[p], `${p} cocok ${pola}`).not.toMatch(pola);
    }
  });
});

/* ─────────────── source guard — angka demo / fallback ─────────────── */

describe("source guard: tidak ada angka demo saat data tidak tersedia", () => {
  it("tidak ada literal rupiah besar di mana pun — itu bentuk angka contoh", () => {
    // `WeeklyTarget` di /analytics jatuh ke 105_000_000 dan 210_000_000 ketika
    // datanya null, lengkap dengan persentase, tanpa satu pun tanda bahwa itu
    // bukan angka sungguhan. Jalur ini tidak boleh punya padanannya.
    for (const p of JALUR_MINGGUAN) {
      expect(RUMUS[p], p).not.toMatch(/\b\d{1,3}(_\d{3}){2,}\b/);
    }
  });

  it("tidak ada Array.from yang membangkitkan baris palsu", () => {
    for (const p of JALUR_MINGGUAN) expect(KODE[p], p).not.toMatch(/Array\.from\(\s*\{\s*length/);
  });

  it("tidak ada `?? 0` maupun `|| 0` pada angka bisnis di lapisan data & domain", () => {
    const domain = ["src/lib/ops/mingguan.ts", "src/lib/ops/bukti.ts", "src/lib/data/mingguan-performa.ts"];
    for (const p of domain) {
      // Yang diizinkan cuma `?? null` — ketiadaan diteruskan, bukan diredam.
      expect(KODE[p], p).not.toMatch(/\?\?\s*0\b/);
      expect(KODE[p], p).not.toMatch(/\|\|\s*0\b/);
    }
  });

  it("pembaca Signal meneruskan nilai_terakhir apa adanya, tidak menolkannya", () => {
    expect(KODE["src/lib/data/signal-baca.ts"]).toContain("nilaiTerakhir: angka(r.nilai_terakhir)");
  });
});

/* ─────────────── CASE 4, 5, 10, 18 — konteks bulanan ─────────────── */

describe("CASE 4 — Monthly Signal tampil sebagai MONTHLY CONTEXT", () => {
  const reader = KODE["src/lib/data/signal-baca.ts"];
  const ui = KODE["src/components/operation/tabel-mingguan.tsx"];

  it("pembacanya mengunci skala 'bulanan'", () => {
    expect(reader).toContain('SKALA_SIGNAL = "bulanan"');
    expect(reader).toContain(".eq(\"skala\", SKALA_SIGNAL)");
  });

  it("pembacanya TIDAK punya parameter minggu maupun skala", () => {
    const tanda = /export async function signalBulananOutlet\(([\s\S]*?)\):/.exec(reader);
    expect(tanda).not.toBeNull();
    expect(tanda![1]).not.toMatch(/minggu|week|skala/i);
  });

  it("tidak ada fungsi apa pun yang mengembalikan Signal per minggu", () => {
    expect(reader).not.toMatch(/function\s+\w*[Mm]inggu\w*Signal/);
    expect(reader).not.toMatch(/signal\w*PerMinggu/i);
  });

  it("UI memberi blok Signal label periode yang eksplisit", () => {
    expect(ui).toContain("Monthly Signals");
    expect(ui).toContain("labelBulan");
  });

  it("UI menyatakan Signal milik BULAN, bukan minggu", () => {
    expect(ui).toContain("milik BULAN, bukan minggu mana pun");
  });
});

describe("CASE 5 — Monthly Target tampil sebagai MONTHLY TARGET CONTEXT", () => {
  const ui = KODE["src/components/operation/tabel-mingguan.tsx"];
  const reader = KODE["src/lib/data/mingguan-performa.ts"];

  it("namanya sendiri menyebut konteks", () => {
    expect(reader).toContain("targetBulananKonteks");
    expect(ui).toContain("Monthly Target");
  });

  it("UI menyatakan ia bukan target minggu", () => {
    expect(ui).toContain("konteks, bukan target minggu");
  });

  it("targetBulananOutlet dibaca sekali dan tidak diolah lebih jauh", () => {
    expect(reader).toContain("targetBulananOutlet(periode)");
    expect(reader).not.toMatch(/targetBulananOutlet\([^)]*\)\s*[/*]/);
  });

  it("kolom konteks dipisahkan garis yang terlihat, bukan disimpulkan dari nama", () => {
    expect(ui).toContain("Konteks bulanan");
    expect(ui).toContain("border-l-2 border-foreground/25");
  });
});

describe("CASE 10 — Signal Agustus di halaman September tetap berlabel Agustus", () => {
  const reader = KODE["src/lib/data/signal-baca.ts"];
  const performa = KODE["src/lib/data/mingguan-performa.ts"];

  it("kuerinya mengunci periode persis, jadi Signal tak pernah lintas bulan", () => {
    expect(reader).toContain('.eq("periode", periode)');
  });

  it("setiap Signal membawa periodenya sendiri", () => {
    expect(reader).toMatch(/periode: r\.periode/);
  });

  it("blok konteksnya menyimpan periode, bukan nomor minggu", () => {
    const blok = /export interface KonteksSignal \{([\s\S]*?)\}/.exec(performa);
    expect(blok).not.toBeNull();
    expect(blok![1]).toContain("periode: string");
    expect(blok![1]).not.toMatch(/minggu/i);
  });

  it("tidak ada satu pun tempat Signal disandingkan dengan nomor minggu", () => {
    expect(performa).not.toMatch(/signal[\s\S]{0,80}\.minggu\b/i);
  });
});

describe("CASE 18 — Signal yang diabaikan tidak tampil sebagai konteks aktif", () => {
  const reader = KODE["src/lib/data/signal-baca.ts"];

  it("kuerinya menyaring status 'terbuka'", () => {
    expect(reader).toContain('.eq("status", "terbuka")');
  });

  it("kuerinya menyaring kondisi terakhir 'lewat_ambang'", () => {
    expect(reader).toContain('.eq("kondisi_terakhir", "lewat_ambang")');
  });

  it("hanya cakupan outlet — Signal area dan korporat punya alamatnya sendiri", () => {
    expect(reader).toContain('.eq("cakupan", "outlet")');
  });
});

/* ─────────────── sumber data & pembatasan cakupan ─────────────── */

describe("sumber data Weekly Performance", () => {
  const reader = KODE["src/lib/data/mingguan-performa.ts"];

  it("membaca esb_net_mingguan lewat pembaca yang sudah ada", () => {
    expect(reader).toContain("netMingguanPerCabang");
  });

  it("TIDAK menjumlahkan seasonal_daily jadi angka mingguan", () => {
    expect(reader).not.toContain("seasonal_daily");
  });

  it("memakai hariTerhitung untuk kelengkapan, bukan menghitung ulang", () => {
    expect(reader).toContain("hariTerhitung");
  });

  it("coordinator diambil dari users.outlet_ids, bukan dari outlets.area_id", () => {
    expect(reader).toContain("u.outletIds");
    expect(reader).toContain('u.role !== "area_coordinator"');
  });

  it("area geografis dan coordinator adalah dua kolom yang berbeda", () => {
    expect(reader).toContain("area: areaName(o.areaId)");
    expect(reader).toContain("coordinator: pemegang.get(o.id)");
  });
});

describe("pembatasan cakupan ada di server", () => {
  const page = KODE["src/app/(app)/operational/weekly/page.tsx"];

  it("halaman memakai scope-v1, bukan menyaring sendiri", () => {
    expect(page).toContain("@/lib/ops/scope-v1");
    expect(page).toContain("persempit(user, getOutlets(), diminta)");
  });

  it("hasil penyempitan itu yang dikirim ke pembaca", () => {
    expect(page).toContain("performaMingguan(periode, cakupan.ids)");
  });

  it("Coordinator Area tidak bisa memilih area lain lewat ?area=", () => {
    expect(page).toContain('terkunci = user.role === "area_coordinator"');
    expect(page).toContain("terkunci ? user.id :");
  });

  it("pintu menu diperiksa sebelum apa pun dibaca", () => {
    expect(page).toContain("canReachMenu(user, MENU)");
    expect(page).toContain("redirect(\"/dashboard\")");
  });
});

/* ─────────────── route: penggantian, bukan penambahan ─────────────── */

describe("route /operational/weekly diganti, bukan ditambah", () => {
  const page = KODE["src/app/(app)/operational/weekly/page.tsx"];

  it("tidak lagi memakai HalamanPerforma", () => {
    expect(page).not.toContain("HalamanPerforma");
  });

  it("memakai TabelMingguan, bukan TabelHarian", () => {
    expect(page).toContain("TabelMingguan");
    expect(page).not.toContain("TabelHarian");
  });

  it("tidak ada berkas halaman Weekly kedua di Operational", () => {
    let ada = true;
    try {
      baca("src/app/(app)/operational/weekly-baru/page.tsx");
    } catch {
      ada = false;
    }
    expect(ada).toBe(false);
  });

  it("alamatnya tetap /operational/weekly", () => {
    expect(page).toContain('href="/operational/weekly"');
  });
});

/* ─────────────── skala non-mingguan tidak tersentuh ─────────────── */

describe("jalur lain tidak tersentuh", () => {
  it("halaman Monthly, Quarterly, dan Yearly masih memakai HalamanPerforma", () => {
    for (const p of [
      "src/app/(app)/operational/monthly/page.tsx",
      "src/app/(app)/operational/quarterly/page.tsx",
      "src/app/(app)/operational/yearly/page.tsx",
    ]) {
      expect(baca(p)).toContain("HalamanPerforma");
    }
  });

  it("halaman Daily masih memakai harianOutlet apa adanya", () => {
    expect(baca("src/app/(app)/operational/daily/page.tsx")).toContain("harianOutlet");
  });

  it("mesin skala lain tidak diubah — barisHarian masih ada di ops/harian.ts", () => {
    expect(baca("src/lib/ops/harian.ts")).toContain("export function barisHarian");
  });

  it("KPI Coordinator Area masih memakai rincianMinggu-nya sendiri", () => {
    expect(baca("src/lib/data/minggu-outlet.ts")).toContain("hitungMinggu");
  });
});
