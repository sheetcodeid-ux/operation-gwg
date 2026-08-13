import "server-only";

import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";
import { hygieneFromRow } from "./rows";
import { listHygiene } from "./store";
import { scopeOutlets } from "../rbac";
import { getOutlets } from "./store";
import type { HygieneAudit, UserProfile } from "@/lib/types";

/**
 * Audit hygiene dibaca LANGSUNG dari database, bukan dari cache di memori.
 *
 * Ini memperbaiki keluhan yang muncul hampir tiap hari: "sudah upload tapi
 * tidak ada di tabel", lalu muncul sendiri beberapa jam kemudian.
 *
 * Penyebabnya bukan penyimpanan yang gagal — datanya selalu tersimpan. Yang
 * salah adalah cara halaman membacanya:
 *
 *  1. Setiap instance serverless memegang salinan tabel di memori.
 *  2. Setelah menulis, `markLocalWrite()` justru menandai salinan itu SEGAR,
 *     supaya baris baru tidak berkedip hilang di instance yang menulis.
 *  3. Tapi `router.refresh()` sesudah simpan bisa mendarat di instance LAIN,
 *     yang salinannya belum memuat baris itu. Instance itu menyajikan snapshot
 *     lamanya lebih dulu dan menyegarkan di latar (stale-while-revalidate),
 *     sehingga jawabannya terkirim TANPA audit yang barusan dibuat.
 *
 * Cache seperti itu masuk akal untuk data yang jarang berubah. Untuk halaman
 * yang dibaca TEPAT SESUDAH menulis, ia salah bentuk: tidak ada nilai TTL yang
 * bisa dipilih, karena masalahnya bukan umur cache melainkan instance mana yang
 * kebetulan melayani permintaannya.
 *
 * Kuerinya tetap dibatasi per bulan, jadi bebannya tidak tumbuh seiring
 * bertambahnya riwayat.
 */

const KOLOM =
  "id,outlet_id,area_id,date,shift,inspector_name,supervisor_name,ratings,findings,is_clean,hygiene_score,created_at";

/**
 * Baca audit satu bulan (atau seluruhnya) untuk outlet yang boleh dilihat.
 *
 * `ratings` ikut diambil di sini — kolom itu sengaja TIDAK ikut hidrasi karena
 * beratnya, sehingga lembar cetak PDF menampilkan "—" pada setiap butir
 * penilaian. Di sini ia hanya dibaca untuk satu bulan, jadi beratnya wajar.
 */
export async function readHygiene(user: UserProfile, monthKey: string | null): Promise<HygieneAudit[]> {
  if (!dbEnabled) return listHygiene(user);

  const ids = scopeOutlets(user, getOutlets()).map((o) => o.id);
  // Tidak ada outlet yang boleh dilihat ⇒ tidak ada audit. Membedakannya dari
  // "tanpa filter" itu penting: keliru di sini membuka audit seluruh cabang.
  if (ids.length === 0) return [];

  const rentang = rentangBulan(monthKey);

  try {
    const rows = await selectAll<Record<string, unknown>>("hygiene", (from, to) => {
      let q = db().from("hygiene").select(KOLOM).in("outlet_id", ids);
      if (rentang) q = q.gte("date", rentang.mulai).lt("date", rentang.selesai);
      return q.order("date", { ascending: false }).range(from, to);
    });
    return rows.map(hygieneFromRow).sort((a, b) => b.date.localeCompare(a.date));
  } catch (e) {
    // Database sedang bermasalah ⇒ tampilkan salinan memori daripada halaman
    // kosong. Lebih baik data agak lama daripada supervisor mengira auditnya
    // hilang.
    console.error("[hygiene] gagal membaca dari database, memakai salinan memori:", e);
    return listHygiene(user);
  }
}

/** Bulan-bulan yang benar-benar punya audit, untuk isi dropdown filternya. */
export async function hygieneMonths(user: UserProfile): Promise<string[]> {
  if (!dbEnabled) return [...new Set(listHygiene(user).map((h) => kunci(h.date)))].sort().reverse();

  const ids = scopeOutlets(user, getOutlets()).map((o) => o.id);
  if (ids.length === 0) return [];
  try {
    // Hanya kolom tanggal — cukup untuk menyusun daftar bulan, dan jauh lebih
    // ringan daripada menarik seluruh barisnya.
    const rows = await selectAll<{ date: string }>("hygiene bulan", (from, to) =>
      db().from("hygiene").select("date").in("outlet_id", ids).order("date", { ascending: false }).range(from, to),
    );
    return [...new Set(rows.map((r) => kunci(r.date)))].sort().reverse();
  } catch {
    return [...new Set(listHygiene(user).map((h) => kunci(h.date)))].sort().reverse();
  }
}

/** Sama persis dengan `monthKey` di lib/month.ts (bulan berbasis 0). */
const kunci = (iso: string) => {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()).padStart(2, "0")}`;
};

/** Awal & akhir bulan dalam UTC, cocok dengan cara `monthKey` menghitungnya. */
function rentangBulan(monthKey: string | null): { mulai: string; selesai: string } | null {
  if (!monthKey) return null;
  const [y, m] = monthKey.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  return {
    mulai: new Date(Date.UTC(y, m, 1)).toISOString(),
    selesai: new Date(Date.UTC(y, m + 1, 1)).toISOString(),
  };
}
