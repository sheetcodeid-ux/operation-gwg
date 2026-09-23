import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * KONTRAK Z-01 — dijaga dengan membaca kodenya sebagai teks.
 *
 * Yang dijaga di sini BUKAN tampilan melainkan JANJI. Sebagian besar di
 * antaranya tidak bisa ditangkap uji perilaku: kode yang mengubah `status`
 * menjadi `acknowledged` tetap berjalan mulus dan hanya salah menurut
 * kontraknya; notifikasi yang lahir tiap cron tetap terkirim dengan benar dan
 * hanya salah menurut jumlahnya.
 */

const akar = process.cwd();
const baca = (p: string) => readFileSync(join(akar, p), "utf8");
const tanpaKomentar = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const tulis = baca("src/lib/data/signal-tulis.ts");
const aksi = baca("src/lib/actions/signals.ts");
const kabar = baca("src/lib/data/signal-notifikasi.ts");
const papan = baca("src/lib/data/command-center.ts");
const bacaWeekly = baca("src/lib/data/signal-baca.ts");
const ui = baca("src/components/operation/papan-command-center.tsx");
const halaman = baca("src/app/(app)/operational/command-center/page.tsx");
const migrasi = baca("supabase/migrations/0113_signal_diakui.sql");

/* ───────────── D1 = B · acknowledged adalah work-state, bukan status ───────────── */

describe("acknowledged tidak pernah menjadi status", () => {
  it("`status` tidak punya nilai ketiga di mana pun", () => {
    for (const src of [tulis, aksi, papan, bacaWeekly, migrasi]) {
      expect(tanpaKomentar(src)).not.toMatch(/['"]acknowledged['"]/);
      expect(tanpaKomentar(src)).not.toMatch(/status\s*[:=]\s*['"]diakui['"]/);
    }
  });

  it("mengakui TIDAK menyentuh `status`", () => {
    const badan = tulis.slice(tulis.indexOf("export async function akuiSignal"), tulis.indexOf("export async function abaikanSignal"));
    expect(badan).toContain('.update({ diakui_oleh: olehUserId, diakui_pada: new Date().toISOString() })');
    // Yang ada cuma SYARAT `status = 'terbuka'`, bukan penetapannya.
    expect(badan).toContain('.eq("status", "terbuka")');
    expect(badan).not.toMatch(/status:\s*['"]/);
  });

  it("mengakui idempoten — pengakuan kedua tidak menimpa yang pertama", () => {
    expect(tulis).toContain('.is("diakui_oleh", null)');
  });

  it("migration hanya MENAMBAH, tidak menghapus apa pun", () => {
    expect(migrasi).toContain("add column if not exists diakui_oleh");
    expect(migrasi).toContain("add column if not exists diakui_pada");
    expect(tanpaKomentar(migrasi)).not.toMatch(/drop\s+(table|column|constraint|trigger|index)/i);
    expect(tanpaKomentar(migrasi)).not.toMatch(/\b(truncate|delete\s+from)\b/i);
    expect(tanpaKomentar(migrasi)).not.toMatch(/\bupdate\s+signals\b/i);
  });

  it("migration mempertahankan SELURUH aturan trigger lama", () => {
    for (const aturan of [
      "signal tidak boleh dihapus",
      "identitas signal % tidak boleh diubah",
      "snapshot deteksi signal % tidak boleh diubah",
      "sudah diabaikan dan tidak boleh dibuka kembali",
    ]) {
      expect(migrasi).toContain(aturan);
    }
  });

  it("migration menambah dua aturan arah untuk pengakuan", () => {
    expect(migrasi).toContain("pengakuan signal % tidak boleh dicabut");
    expect(migrasi).toContain("tidak boleh ditimpa");
  });
});

/* ───────────── Q4 · dua pintu otorisasi yang berbeda ───────────── */

describe("otorisasi tindakan diperiksa di server", () => {
  it("keduanya melewati canReachMenu lebih dulu", () => {
    expect(aksi.match(/canReachMenu\(user, MENU_COMMAND_CENTER\)/g) ?? []).toHaveLength(2);
  });

  it("hanya MENGABAIKAN yang menuntut manage_signals", () => {
    expect(aksi.match(/can\(user, "manage_signals"\)/g) ?? []).toHaveLength(1);
    const abaikan = aksi.slice(aksi.indexOf("export async function abaikanSignalAction"));
    expect(abaikan).toContain('can(user, "manage_signals")');
  });

  it("alasan dipangkas dan wajib tidak kosong — di action DAN di data layer", () => {
    expect(aksi).toContain("(alasan ?? \"\").trim()");
    expect(aksi).toContain("Alasan wajib diisi.");
    expect(tulis).toContain("alasan.trim()");
    expect(tulis).toContain("bersih.length === 0");
  });

  it("tidak ada jalan membuka kembali, dan tidak ada penghapusan", () => {
    for (const src of [tulis, aksi]) {
      expect(tanpaKomentar(src)).not.toMatch(/status:\s*['"]terbuka['"]/);
      expect(tanpaKomentar(src)).not.toMatch(/\.delete\(\)/);
    }
  });

  it("mengabaikan menyimpan aktor, waktu, dan alasan sekaligus", () => {
    for (const kolom of ["diabaikan_oleh:", "diabaikan_pada:", "diabaikan_alasan:"]) {
      expect(tulis).toContain(kolom);
    }
  });
});

/* ───────────── O8 · notifikasi critical, sekali seumur Signal ───────────── */

describe("notifikasi Signal critical", () => {
  it("hanya `critical`", () => {
    expect(kabar).toContain('.eq("severity", "critical")');
  });

  it("hanya Signal yang masih terbuka dan masih melanggar", () => {
    expect(kabar).toContain('.eq("status", "terbuka")');
    expect(kabar).toContain('.eq("kondisi_terakhir", "lewat_ambang")');
  });

  it("penangkalnya `href`, dan `href` memuat signals.id (D3)", () => {
    expect(kabar).toContain("export const hrefSignal");
    expect(kabar).toContain("signal=${id}");
    expect(kabar).toContain("bacaSudahDikabarkan");
  });

  it("penangkal duplikat TIDAK bergantung pada sudah/belum dibaca", () => {
    const fn = kabar.slice(kabar.indexOf("async function bacaSudahDikabarkan"));
    expect(fn).not.toContain('"read"');
    expect(fn).not.toContain('"dismissed"');
  });

  it("TIDAK memakai notifyCollapsed — ia menggabungkan hanya selama belum dibaca", () => {
    expect(tanpaKomentar(kabar)).not.toContain("notifyCollapsed");
  });

  it("tidak menambah kolom relasi ke notifications", () => {
    for (const kolom of ["signal_id", "entity_type", "entity_id"]) {
      expect(kabar).not.toContain(kolom);
    }
  });

  it("penerimanya diputuskan izin, bukan nama peran", () => {
    expect(kabar).toContain('can({ role: u.role as Role }, "manage_signals")');
    expect(tanpaKomentar(kabar)).not.toMatch(/['"]head_operation['"]|['"]super_admin['"]/);
  });

  it("tidak menyentuh `signals` sama sekali", () => {
    expect(tanpaKomentar(kabar)).not.toMatch(/\.update\(|\.insert\(|\.upsert\(|\.delete\(/);
  });
});

/* ───────────── Q1–Q3 · pembaca Command Center ───────────── */

describe("pembaca Command Center", () => {
  it("hanya `status = terbuka` (Q3)", () => {
    expect(papan.match(/\.eq\("status", "terbuka"\)/g) ?? []).toHaveLength(2);
    expect(tanpaKomentar(papan)).not.toMatch(/['"]diabaikan['"]/);
  });

  it("outlet DAN korporat, tanpa area (Q1)", () => {
    expect(papan).toContain('.eq("cakupan", "outlet")');
    expect(papan).toContain('.eq("cakupan", "korporat")');
    expect(tanpaKomentar(papan)).not.toMatch(/\.eq\("cakupan", "area"\)/);
  });

  it("skala tetap bulanan lewat primitif bersama", () => {
    expect(papan).toContain("SKALA_SIGNAL");
    expect(tanpaKomentar(papan)).not.toMatch(/['"]mingguan['"]|['"]harian['"]/);
  });

  it("periode boleh null — lintas periode (Q2)", () => {
    expect(papan).toContain("periode: string | null");
    expect(papan).toContain('if (periode !== null) q = q.eq("periode", periode);');
  });

  it("tidak menulis apa pun", () => {
    expect(tanpaKomentar(papan)).not.toMatch(/\.update\(|\.insert\(|\.upsert\(|\.delete\(|\.rpc\(/);
  });

  it("pembaca Weekly tidak berubah kontraknya — backward compatible", () => {
    expect(bacaWeekly).toContain('export const SKALA_SIGNAL = "bulanan" as const;');
    expect(bacaWeekly).toContain('.eq("cakupan", "outlet")');
    expect(bacaWeekly).toContain('.eq("status", "terbuka")');
    expect(bacaWeekly).toContain("export async function signalBulananOutlet");
  });
});

/* ───────────── Z-03 · MTD tetap indikasi ───────────── */

describe("kontrak MTD di layar baru", () => {
  it("bulan berjalan bertanda MTD · indikasi", () => {
    expect(ui).toContain("MTD · indikasi");
    expect(ui).toContain("bulan penuh");
  });

  it("kalimat MTD menolak kata vonis", () => {
    expect(ui).toContain("bukan hasil bulan penuh");
    expect(ui).toContain("bukan diagnosis");
  });

  it('kosong berbunyi "belum ada indikasi", bukan "tidak ada" dan bukan nol', () => {
    expect(ui).toContain("Belum ada indikasi");
    expect(ui).toContain("bukan pernyataan bahwa semuanya aman");
    expect(tanpaKomentar(ui)).not.toMatch(/>\s*tidak ada\s*</i);
  });

  it("tidak ada bahasa yang menyatakan kepastian", () => {
    for (const d of ["performa buruk", "bulan bermasalah", "hasil final", "terbukti buruk"]) {
      expect(ui.toLowerCase()).not.toContain(d);
    }
  });
});

/* ───────────── K · gerbang halaman ───────────── */

describe("halaman memasang gerbang sebelum query", () => {
  it("canReachMenu dijalankan lebih dulu", () => {
    const i = halaman.indexOf("canReachMenu");
    const j = halaman.indexOf("papanCommandCenter({");
    expect(i).toBeGreaterThan(-1);
    expect(i).toBeLessThan(j);
  });

  it("cakupan outlet tetap lewat persempit()", () => {
    expect(halaman).toContain("persempit(user, getOutlets())");
  });

  it("izin mengabaikan diturunkan dari manage_signals", () => {
    expect(halaman).toContain('can(user, "manage_signals")');
  });
});

/* ───────────── P · migration ───────────── */

describe("migration bertambah satu, dan hanya satu", () => {
  it("jumlahnya 113", () => {
    expect(readdirSync(join(akar, "supabase/migrations")).filter((f) => f.endsWith(".sql"))).toHaveLength(113);
  });

  it("tidak ada kolom ownership yang ikut diselundupkan (Q5 → Z-02)", () => {
    for (const d of ["assignee", "owner_id", "deadline", "sla", "ditugaskan"]) {
      expect(migrasi.toLowerCase()).not.toContain(d);
    }
  });
});
