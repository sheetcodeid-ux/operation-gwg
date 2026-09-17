import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * FINALISASI ADALAH PERPINDAHAN KEADAAN, BUKAN PERHITUNGAN ULANG.
 *
 * Kalimat itu mudah disetujui dan mudah dilanggar: menambahkan satu pemanggilan
 * `hitungSales()` "supaya angkanya pasti terbaru saat ditutup" terlihat seperti
 * kehati-hatian, dan akibatnya angka yang sudah dibaca orang sepanjang bulan
 * berubah di detik terakhir — bersamaan dengan perubahan status yang memang
 * diharapkan, jadi tidak ada yang menyadarinya.
 *
 * Uji di sini membaca kode sumbernya dan gagal begitu itu terjadi.
 */

const tanpaKomentar = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

const kode = tanpaKomentar("src/lib/data/kpi-finalisasi.ts");
const sql = tanpaKomentar("supabase/migrations/0108_finalisasi_kpi_bulanan.sql").replace(/--.*$/gm, "");

describe("tidak menghitung ulang apa pun", () => {
  it("tidak memanggil satu pun mesin KPI", () => {
    for (const mesin of ["hitungSales", "hitungKeuangan", "hitungTargetSales", "saringFakta"]) {
      expect(kode).not.toContain(mesin);
    }
  });

  it("tidak membaca satu pun tabel sumber", () => {
    for (const tabel of ["seasonal_daily", "op_expenses", "op_purchases", "op_pnl", "esb_net_bulanan"]) {
      expect(kode).not.toContain(tabel);
      expect(sql).not.toContain(tabel);
    }
  });

  it("tidak memanggil ESB", () => {
    for (const p of ["ambilKunciEsb", "syncSeasonalDays", "syncNetBulanan", "esbSetDeadline"]) {
      expect(kode).not.toContain(p);
    }
  });

  it("tidak menyentuh targets", () => {
    // Siklus hidup target tetap draf → berlaku → diganti. Tidak ada `final`.
    expect(kode).not.toContain("targets");
    expect(sql).not.toContain("targets");
  });
});

describe("hanya status yang berubah", () => {
  it("satu-satunya UPDATE menyetel status", () => {
    const update = sql.match(/update\s+kpi_values[\s\S]*?;/g) ?? [];
    expect(update).toHaveLength(1);
    expect(update[0]).toContain("set status = 'final'");
    for (const kolom of ["nilai", "versi", "terkini =", "cakupan", "periode =", "skala =", "catatan"]) {
      expect(update[0].slice(0, update[0].indexOf("where"))).not.toContain(kolom);
    }
  });

  it("tidak ada INSERT maupun DELETE", () => {
    expect(sql).not.toMatch(/insert\s+into/i);
    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
  });

  it("tidak melahirkan versi baru", () => {
    expect(sql).not.toMatch(/versi\s*\+\s*1/);
    expect(sql).not.toContain("max(versi)");
  });
});

describe("hanya sementara yang berpindah", () => {
  it("saringannya menyebut sementara, bukan sekadar 'bukan final'", () => {
    expect(sql).toContain("status = 'sementara'");
    expect(sql).not.toContain("status <> 'final'");
    expect(sql).not.toContain("status != 'final'");
  });

  it("tidak_tersedia dan invalid tidak pernah disebut sebagai yang diubah", () => {
    const update = (sql.match(/update\s+kpi_values[\s\S]*?;/g) ?? [""])[0];
    expect(update).not.toContain("tidak_tersedia");
    expect(update).not.toContain("invalid");
  });

  it("hanya baris terkini yang tersentuh", () => {
    const update = (sql.match(/update\s+kpi_values[\s\S]*?;/g) ?? [""])[0];
    expect(update).toContain("and terkini");
  });

  it("hanya skala bulanan", () => {
    const update = (sql.match(/update\s+kpi_values[\s\S]*?;/g) ?? [""])[0];
    expect(update).toContain("skala = 'bulanan'");
  });
});

describe("bulan berjalan datang dari aplikasi, bukan dari basis data", () => {
  it("fungsinya menerima bulan berjalan sebagai parameter", () => {
    expect(sql).toContain("p_bulan_berjalan text");
  });

  it("basis data tidak pernah menghitung bulannya sendiri", () => {
    // Postgres produksi berjalan di UTC. `now()` di sini berarti tujuh jam
    // salah tiap pergantian bulan.
    expect(sql).not.toMatch(/to_char\s*\(\s*now\(\)/i);
    expect(sql).not.toMatch(/current_date/i);
  });

  it("lapisan data memakai periodeBerjalan() yang WIB", () => {
    expect(kode).toContain("periodeBerjalan(pada)");
  });
});

describe("kunci dan hak jalan", () => {
  it("memakai kunci yang SAMA dengan penulis, supaya keduanya tidak bertabrakan", () => {
    expect(sql).toContain("pg_advisory_xact_lock(hashtext('gwg_kpi_bulanan')");
  });

  it("hak jalannya dicabut dari public, anon, dan authenticated", () => {
    expect(sql).toContain("revoke all on function public.gwg_finalisasi_kpi_bulanan(text) from public, anon, authenticated");
    expect(sql).toContain("grant execute on function public.gwg_finalisasi_kpi_bulanan(text) to service_role");
  });

  it("berjalan sebagai security definer dengan search_path terkunci", () => {
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public, pg_temp");
  });
});

describe("rute cron menjalankan keduanya dan bisa membedakannya", () => {
  const rute = tanpaKomentar("src/app/api/cron/kpi-bulanan/route.ts");

  it("generasi dulu, finalisasi kemudian", () => {
    expect(rute.indexOf("generateTerjadwal(")).toBeGreaterThan(-1);
    expect(rute.indexOf("finalisasiPeriodeSelesai(")).toBeGreaterThan(rute.indexOf("generateTerjadwal("));
  });

  it("sinkron_sehat memisahkan generasi dari finalisasi", () => {
    expect(rute).toContain("generasi:");
    expect(rute).toContain("finalisasi:");
  });

  it("gagal tetap membalas 500 dan mencatat galat", () => {
    expect(rute).toContain("status: 500");
    expect(rute).toContain("error: pesan");
    expect(rute.match(/catatHasilSinkron\(/g) ?? []).toHaveLength(2);
  });

  it("otorisasinya tidak berubah", () => {
    expect(rute).toContain('cronAuthorized(req, "kpi_bulanan_token", "kpi-bulanan")');
    expect(rute).toContain("status: 401");
  });

  it("tidak ada penjadwal kedua yang ditambahkan", () => {
    const v = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as { crons: { path: string }[] };
    expect(v.crons).toHaveLength(2);
    expect(v.crons.map((c) => c.path)).toEqual(["/api/cron/fraud-sync", "/api/cron/bersih-foto"]);
  });
});
