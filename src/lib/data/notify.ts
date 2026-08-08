import "server-only";

import { randomUUID } from "node:crypto";
import { db, dbEnabled } from "./db";
import type { AppNotification, NotificationKind } from "@/lib/types";

/**
 * Pengiriman notifikasi aktivitas.
 *
 * Satu pintu untuk seluruh modul, supaya bentuk notifikasi tidak berbeda-beda
 * tergantung siapa yang mengirimnya.
 *
 * Dua aturan yang menentukan seluruh rancangan ini:
 *
 * 1. **Penerimanya tim, bukan orang.** Aktivitas seperti "pengajuan design
 *    masuk" tidak punya satu penerima yang benar — yang benar adalah SELURUH
 *    tim Creative. Sebelumnya notifikasi hanya bisa ditujukan ke satu orang
 *    atau ke pemilik outlet, sehingga aktivitas tim tidak pernah dikirim sama
 *    sekali.
 *
 * 2. **Selalu membawa tautan tujuan.** Notifikasi tanpa `href` cuma bisa
 *    dibaca; orangnya masih harus mencari sendiri pengajuan mana yang dimaksud,
 *    dan itu membuat notifikasinya nyaris tidak berguna.
 *
 * Kegagalan pengiriman TIDAK PERNAH menggagalkan aksi yang memicunya. Pengajuan
 * yang sudah tersimpan tidak boleh dianggap gagal hanya karena notifikasinya
 * tidak terkirim.
 */

export interface NotifyInput {
  kind: NotificationKind;
  title: string;
  message: string;
  /** Halaman tujuan saat diklik — hampir selalu wajib diisi. */
  href?: string;
  /** Penerima perorangan. */
  targetUser?: string;
  /** Penerima satu tim. Salah satu dari ini atau `targetUser` harus ada. */
  department?: string;
  /** Nama pelaku, untuk baris "oleh siapa". */
  actorName?: string;
  outletId?: string;
  areaId?: string;
  severity?: AppNotification["severity"];
}

/** Kirim satu notifikasi. Aman dipanggil tanpa `await` menghentikan alur. */
export async function notify(input: NotifyInput): Promise<void> {
  if (!dbEnabled) return;
  if (!input.targetUser && !input.department) return; // tanpa penerima = tidak ada gunanya
  try {
    await db()
      .from("notifications")
      .insert({
        id: `ntf_${randomUUID()}`,
        kind: input.kind,
        title: input.title.slice(0, 160),
        message: input.message.slice(0, 400),
        href: input.href ?? null,
        target_user: input.targetUser ?? null,
        department: input.department ?? null,
        actor_name: input.actorName ?? null,
        outlet_id: input.outletId ?? null,
        area_id: input.areaId ?? null,
        severity: input.severity ?? "info",
        read: false,
        dismissed: false,
        created_at: new Date().toISOString(),
      });
  } catch {
    // Sengaja ditelan: notifikasi adalah efek samping, bukan inti pekerjaannya.
  }
}

/**
 * Kirim ke beberapa penerima sekaligus, tanpa mengirim ke diri sendiri.
 *
 * Pelakunya sendiri dikecualikan karena ia baru saja melakukan tindakannya —
 * memberitahunya lagi hanya menambah kebisingan dan membuat lencana angka
 * kelihatan salah.
 */
export async function notifyMany(
  inputs: NotifyInput[],
  actorId?: string,
): Promise<void> {
  const kirim = inputs.filter((n) => !(actorId && n.targetUser === actorId));
  await Promise.all(kirim.map(notify));
}

/**
 * Kirim ke banyak orang, tapi paling banyak SATU baris hidup per orang untuk
 * tujuan yang sama.
 *
 * Dipakai untuk kejadian beruntun — terutama pesan masuk. Sepuluh pesan dalam
 * satu percakapan bukan sepuluh kabar berbeda; itu satu kabar ("ada pesan dari
 * Ani") yang isinya diperbarui. Tanpa penggabungan ini, satu percakapan singkat
 * saja sudah cukup untuk mendorong seluruh notifikasi lain keluar dari daftar.
 *
 * Baris yang sudah dibaca atau sudah ditutup TIDAK ikut diperbarui: keduanya
 * berarti orangnya sudah selesai dengan kabar itu, jadi yang baru memang layak
 * jadi baris baru.
 */
export async function notifyCollapsed(
  input: Omit<NotifyInput, "targetUser" | "department"> & { href: string; targetUsers: string[] },
): Promise<void> {
  if (!dbEnabled) return;
  const penerima = [...new Set(input.targetUsers)].filter(Boolean);
  if (penerima.length === 0) return;

  const title = input.title.slice(0, 160);
  const message = input.message.slice(0, 400);
  const now = new Date().toISOString();

  try {
    const { data } = await db()
      .from("notifications")
      .select("id, target_user")
      .eq("kind", input.kind)
      .eq("href", input.href)
      .eq("read", false)
      .eq("dismissed", false)
      .in("target_user", penerima);

    const lama = (data ?? []) as { id: string; target_user: string }[];
    const sudahAda = new Set(lama.map((r) => r.target_user));

    // Bukan `Promise[]`: pembangun kueri Supabase hanya "thenable", belum janji
    // penuh — ia baru berjalan saat di-await.
    const kerja: PromiseLike<unknown>[] = [];
    if (lama.length > 0) {
      kerja.push(
        db()
          .from("notifications")
          .update({ title, message, actor_name: input.actorName ?? null, created_at: now })
          .in("id", lama.map((r) => r.id)),
      );
    }
    const baru = penerima.filter((id) => !sudahAda.has(id));
    if (baru.length > 0) {
      kerja.push(
        db()
          .from("notifications")
          .insert(
            baru.map((uid) => ({
              id: `ntf_${randomUUID()}`,
              kind: input.kind,
              title,
              message,
              href: input.href,
              target_user: uid,
              department: null,
              actor_name: input.actorName ?? null,
              outlet_id: input.outletId ?? null,
              area_id: input.areaId ?? null,
              severity: input.severity ?? "info",
              read: false,
              dismissed: false,
              created_at: now,
            })),
          ),
      );
    }
    await Promise.all(kerja);
  } catch {
    // Sama seperti `notify`: pesannya sudah tersimpan, notifikasinya efek samping.
  }
}
