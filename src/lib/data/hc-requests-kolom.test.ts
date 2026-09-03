import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Kolom `hc_requests` yang benar-benar ada di database.
 *
 * MENGAPA DAFTAR INI ADA. Dashboard Penilaian Request sempat tayang dengan
 * layar kosong terus-menerus padahal penilaiannya tersimpan rapi. Penyebabnya
 * satu kueri yang meminta `requester_name` dan `outlet_name` — dua kolom yang
 * TIDAK pernah ada di tabelnya; keduanya disusun di `fromRow` dari
 * `requester_id` dan `outlet_id`. Supabase menjawab dengan error, `data` jadi
 * null, dan kode pemanggilnya membaca null itu sebagai "belum ada data".
 *
 * Itulah bentuk kegagalan yang paling mahal: tidak ada yang merah. TypeScript
 * tidak tahu isi tabel, lint tidak, tes tidak, build tidak — yang tahu cuma
 * pengguna yang membuka layarnya dan tidak menemukan apa pun.
 *
 * `hc_requests` dibuat sebelum folder migrasi ini ada, jadi bentuknya tidak
 * bisa diturunkan dari berkas mana pun. Daftar ini salinannya. Menambah kolom
 * berarti ikut menambahkannya di sini — sengaja, supaya ada satu tempat di
 * dalam repo yang bisa dibaca tanpa membuka dashboard Supabase.
 */
const KOLOM_HC_REQUESTS = new Set([
  "id", "kind", "department", "requester_id", "title", "description", "position",
  "headcount", "recruited", "training_type", "participants", "budget",
  "budget_approved", "planned_date", "attachments", "status", "hc_note",
  "finance_note", "hc_by", "finance_by", "created_at", "updated_at",
  "completed_at", "participant_names", "subject_name", "design_type",
  "design_size", "assignee_id", "work_task_id", "revisions", "scope",
  "outlet_id", "hasil",
]);

/** Semua berkas .ts di bawah src/, tanpa berkas tes. */
function berkasTs(dir: string, hasil: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) berkasTs(p, hasil);
    else if (/\.tsx?$/.test(e.name) && !e.name.includes(".test.")) hasil.push(p);
  }
  return hasil;
}

describe("kueri hc_requests hanya menyebut kolom yang ada", () => {
  it("tidak ada kolom karangan di seluruh src/", () => {
    const salah: string[] = [];
    for (const f of berkasTs(join(process.cwd(), "src"))) {
      const isi = readFileSync(f, "utf8");
      // `.from("hc_requests")` lalu `.select("…")` — spasi dan baris baru di
      // antaranya diabaikan, karena pemformat kode memecahnya berbeda-beda.
      for (const m of isi.matchAll(/from\("hc_requests"\)\s*\.?\s*\n?\s*\.select\("([^"]*)"\)/g)) {
        const daftar = m[1];
        if (daftar.includes("*") || daftar.includes("(")) continue; // ambil semua / relasi bersarang
        for (const kolom of daftar.split(",").map((k) => k.trim()).filter(Boolean)) {
          if (!KOLOM_HC_REQUESTS.has(kolom)) salah.push(`${f.replace(process.cwd() + "/", "")}: ${kolom}`);
        }
      }
    }
    expect(salah).toEqual([]);
  });

  it("nama pemohon dan nama outlet TIDAK diambil sebagai kolom", () => {
    // Persis dua nama yang membuat dashboard-nya kosong. Keduanya hasil
    // pencarian dari id-nya, bukan isi tabel — dan keduanya terlihat sangat
    // masuk akal sebagai nama kolom, yang justru membuatnya mudah terulang.
    expect(KOLOM_HC_REQUESTS.has("requester_name")).toBe(false);
    expect(KOLOM_HC_REQUESTS.has("outlet_name")).toBe(false);
  });
});
