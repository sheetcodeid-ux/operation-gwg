import "server-only";

import { db, dbEnabled } from "./db";
import { notify } from "./notify";
import { selectAll } from "./paged";
import { can } from "@/lib/rbac";
import type { Role } from "@/lib/types";

/**
 * NOTIFIKASI SIGNAL CRITICAL — memakai infrastruktur yang sudah ada, apa adanya.
 *
 * ┌─ SEKALI SEUMUR SIGNAL, DAN ITU YANG PALING MENENTUKAN ───────────────────┐
 * │                                                                          │
 * │ Deteksi berjalan tiap hari untuk bulan berjalan. Tanpa penangkal, satu   │
 * │ Signal September akan mengirim kabar yang sama tiga puluh kali dalam     │
 * │ sebulan — dan notifikasi yang berulang begitu berhenti dibaca orang      │
 * │ jauh sebelum bulannya habis.                                             │
 * │                                                                          │
 * │ `notifyCollapsed()` TIDAK dipakai untuk ini: ia menggabungkan hanya      │
 * │ selama barisnya belum dibaca. Begitu seseorang membacanya, kabar yang    │
 * │ sama lahir lagi sebagai baris baru — perilaku yang benar untuk pesan     │
 * │ masuk, dan salah untuk ini.                                              │
 * │                                                                          │
 * │ Penangkalnya `href`, yang memang memuat `signals.id` dan unik per        │
 * │ Signal. Sebelum mengirim, baris yang sudah ada dengan `href` itu dibaca  │
 * │ lebih dulu — TERMASUK yang sudah dibaca dan yang sudah ditutup. Tidak    │
 * │ ada kolom baru, tidak ada tabel baru, tidak ada migration.               │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ YANG TIDAK DILAKUKAN BERKAS INI ────────────────────────────────────────┐
 * │                                                                          │
 * │ Tidak menilai apa pun, tidak menyentuh `signals`, tidak mengubah         │
 * │ `severity`, tidak mengubah `kondisi_terakhir`, dan tidak pernah          │
 * │ menggantikan Signal. Notifikasi cuma pengantar ke layar; Signal-nya      │
 * │ tetap satu-satunya catatan bahwa sesuatu terdeteksi.                     │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

/** Jenis notifikasi Signal. Tidak ada CHECK `kind` di basis data, jadi ini
 *  murni penambahan TypeScript. */
export const JENIS_SIGNAL = "signal_critical" as const;

/**
 * Alamat tujuan — sekaligus penanda identitas Signal (Z-01 · D3).
 *
 * `signals.id` ikut di dalamnya, jadi notifikasi selalu bisa ditelusuri balik
 * tanpa satu kolom relasi pun di `notifications`.
 */
export const hrefSignal = (id: number, periode: string): string =>
  `/operational/command-center?bulan=${periode}&signal=${id}`;

export interface RingkasNotifikasi {
  /** Signal critical terbuka yang ditemukan pada periode yang diperiksa. */
  kandidat: number;
  /** Yang belum pernah dikabarkan sama sekali. */
  baru: number;
  penerima: number;
  terkirim: number;
}

interface BarisSignal {
  id: number;
  periode: string;
  cakupan: string;
  outlet_id: string | null;
  kpi_definition_id: string;
  nilai_actual: number | string;
  nilai_ambang: number | string;
  status_kpi: string;
}

interface BarisUser {
  id: string;
  role: string;
  active: boolean;
}

const KOSONG: RingkasNotifikasi = { kandidat: 0, baru: 0, penerima: 0, terkirim: 0 };

/**
 * Kabarkan Signal `critical` yang belum pernah dikabarkan.
 *
 * Dipanggil SETELAH deteksi, dari rute cron. Kegagalannya tidak pernah
 * menggagalkan deteksi: Signal yang sudah tersimpan tetap sah walau kabarnya
 * tidak terkirim — pola yang sama dengan `notify()` sendiri.
 */
export async function kabarkanSignalCritical(periode: readonly string[]): Promise<RingkasNotifikasi> {
  if (!dbEnabled || periode.length === 0) return KOSONG;

  try {
    const [signal, penerima] = await Promise.all([bacaCritical([...new Set(periode)]), bacaPenerima()]);
    if (signal.length === 0 || penerima.length === 0) {
      return { ...KOSONG, kandidat: signal.length, penerima: penerima.length };
    }

    const sudah = await bacaSudahDikabarkan(signal.map((s) => hrefSignal(s.id, s.periode)));
    const baru = signal.filter((s) => !sudah.has(hrefSignal(s.id, s.periode)));

    let terkirim = 0;
    for (const s of baru) {
      for (const p of penerima) {
        await notify({
          kind: JENIS_SIGNAL,
          title: `Signal critical — ${s.kpi_definition_id}`,
          message: pesan(s),
          href: hrefSignal(s.id, s.periode),
          targetUser: p,
          outletId: s.outlet_id ?? undefined,
          severity: "critical",
        });
        terkirim += 1;
      }
    }
    return { kandidat: signal.length, baru: baru.length, penerima: penerima.length, terkirim };
  } catch {
    return KOSONG;
  }
}

/**
 * Kalimatnya menyebut angka apa adanya DAN keadaan periodenya.
 *
 * `sementara` berarti bulannya masih berjalan, dan Z-03 mengunci bahwa Signal
 * bulan berjalan adalah INDIKASI — bukan vonis, bukan hasil bulan penuh.
 * Menghilangkan keterangan itu dari kabar yang masuk ke ponsel orang membuat
 * satu-satunya kalimat yang mereka baca menjadi kalimat yang terlalu yakin.
 */
function pesan(s: BarisSignal): string {
  const unit = s.cakupan === "korporat" ? "Korporat" : "Outlet";
  const keadaan = s.status_kpi === "sementara" ? " Bulan masih berjalan — ini indikasi, bukan hasil bulan penuh." : "";
  return `${unit} · ${s.periode}. Angka ${Number(s.nilai_actual).toFixed(2)} terhadap ambang ${Number(s.nilai_ambang)}.${keadaan}`;
}

/* ─────────────────────────────── pembacaan ─────────────────────────────── */

/** Signal `critical` yang MASIH terbuka dan pengamatan terakhirnya masih
 *  melanggar — himpunan yang sama dengan daftar kerja Command Center. */
function bacaCritical(periode: string[]): Promise<BarisSignal[]> {
  return selectAll<BarisSignal>("signals", (a, b) =>
    db()
      .from("signals")
      .select("id,periode,cakupan,outlet_id,kpi_definition_id,nilai_actual,nilai_ambang,status_kpi")
      .eq("severity", "critical")
      .eq("status", "terbuka")
      .eq("kondisi_terakhir", "lewat_ambang")
      .in("periode", periode)
      .order("id")
      .range(a, b),
  );
}

/**
 * Penerimanya pemegang `manage_signals` (Z-01 · D4).
 *
 * Perannya dibaca dari basis data, bukan dari `store` — rute cron tidak
 * menjalankan hidrasi, dan daftar yang kosong akan membuat kabarnya hilang
 * tanpa satu galat pun. Izinnya tetap diputuskan `ROLE_PERMISSIONS`; berkas ini
 * tidak pernah menyebut nama peran.
 */
async function bacaPenerima(): Promise<string[]> {
  const baris = await selectAll<BarisUser>("users", (a, b) =>
    db().from("users").select("id,role,active").eq("active", true).order("id").range(a, b),
  );
  return baris.filter((u) => can({ role: u.role as Role }, "manage_signals")).map((u) => u.id);
}

/** Alamat yang SUDAH pernah dikabarkan — apa pun keadaan bacanya. */
async function bacaSudahDikabarkan(href: string[]): Promise<Set<string>> {
  if (href.length === 0) return new Set();
  const baris = await selectAll<{ href: string | null }>("notifications", (a, b) =>
    db().from("notifications").select("href").eq("kind", JENIS_SIGNAL).in("href", href).order("id").range(a, b),
  );
  return new Set(baris.map((r) => r.href).filter((h): h is string => !!h));
}
