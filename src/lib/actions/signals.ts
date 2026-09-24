"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { abaikanSignal, akuiSignal } from "@/lib/data/signal-tulis";
import { can } from "@/lib/rbac";
import { canReachMenu, MENU_COMMAND_CENTER } from "@/lib/nav";

/**
 * DUA TINDAKAN COMMAND CENTER, DAN OTORISASINYA DIPUTUSKAN DI SINI.
 *
 * ┌─ DUA PINTU YANG BERBEDA, DAN ITU DISENGAJA ──────────────────────────────┐
 * │                                                                          │
 * │   MENGAKUI   siapa pun yang boleh membuka Command Center                 │
 * │              "saya sudah melihatnya" tidak menghentikan apa pun; yang    │
 * │              melihat memang orang yang sedang bekerja di layar itu.      │
 * │                                                                          │
 * │   MENGABAIKAN  hanya pemegang `manage_signals`                           │
 * │              ia MENGHENTIKAN tindak lanjut dan tidak bisa dibatalkan.    │
 * │              `src/lib/rbac.ts` sudah menyatakan alasannya sejak Phase 4: │
 * │              itu bukan hak Coordinator Area.                             │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Keduanya diperiksa DI SERVER. Tombol yang disembunyikan di layar bukan
 * otorisasi — siapa pun bisa memanggil action-nya langsung.
 */

export type HasilAksi = { ok: true; berubah: boolean } | { ok: false; pesan: string };

const DITOLAK = "Anda tidak berhak melakukan tindakan ini.";

/**
 * Tandai satu Signal sudah dilihat.
 *
 * Tidak mengubah `status`, `severity`, snapshot, maupun identitas Signal —
 * yang berubah hanya `diakui_oleh` dan `diakui_pada`.
 */
export async function akuiSignalAction(id: number): Promise<HasilAksi> {
  const user = await getSessionUser();
  if (!user) return { ok: false, pesan: DITOLAK };
  if (!canReachMenu(user, MENU_COMMAND_CENTER)) return { ok: false, pesan: DITOLAK };
  if (!Number.isInteger(id) || id <= 0) return { ok: false, pesan: "Signal tidak dikenal." };

  const hasil = await akuiSignal(id, user.id);
  if (!hasil.ok) return { ok: false, pesan: "Gagal menyimpan. Coba lagi." };
  revalidatePath("/operational/command-center");
  return { ok: true, berubah: hasil.berubah };
}

/**
 * Nyatakan satu Signal tidak perlu ditindaklanjuti. TIDAK DAPAT DIBATALKAN.
 *
 * Alasannya wajib. Yang dipangkas kosong ditolak di sini, dan ditolak lagi
 * oleh `signals_diabaikan_utuh` di basis data — dua lapis, karena keputusan
 * yang tidak bisa ditarik kembali tanpa alasan tertulis tidak bisa diaudit
 * siapa pun.
 */
export async function abaikanSignalAction(id: number, alasan: string): Promise<HasilAksi> {
  const user = await getSessionUser();
  if (!user) return { ok: false, pesan: DITOLAK };
  if (!canReachMenu(user, MENU_COMMAND_CENTER)) return { ok: false, pesan: DITOLAK };
  // Gerbang kedua, dan inilah yang membedakan tindakan ini dari mengakui.
  if (!can(user, "manage_signals")) return { ok: false, pesan: DITOLAK };
  if (!Number.isInteger(id) || id <= 0) return { ok: false, pesan: "Signal tidak dikenal." };

  const bersih = (alasan ?? "").trim();
  if (bersih.length === 0) return { ok: false, pesan: "Alasan wajib diisi." };

  const hasil = await abaikanSignal(id, user.id, bersih);
  if (!hasil.ok) {
    return {
      ok: false,
      pesan: hasil.alasan === "sudah_diabaikan" ? "Signal ini sudah diabaikan orang lain." : "Gagal menyimpan. Coba lagi.",
    };
  }
  revalidatePath("/operational/command-center");
  return { ok: true, berubah: hasil.berubah };
}
