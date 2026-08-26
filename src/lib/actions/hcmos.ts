"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { getOutlets } from "@/lib/data/store";
import { db, dbEnabled } from "@/lib/data/db";
import { r2Enabled, r2Put, R2_PREFIX } from "@/lib/storage/r2";
import { canAccessOutlet } from "@/lib/rbac";
import { periodeLabel } from "@/lib/hcmos/kontrak";
import { notify } from "@/lib/data/notify";
import {
  hapusKontrak,
  rekapOutlet,
  pemilikKontrak,
  riwayatUpdateBulanan,
  simpanKontrak,
  simpanUpdateBulanan,
  type SimpanKontrakInput,
  type UpdateBulanan,
} from "@/lib/data/hcmos";
import { bolehUbahHc } from "@/lib/hcmos/akses";
import type { UserProfile } from "@/lib/types";

/**
 * Tindakan Kontrak Tracker.
 *
 * Wewenangnya diperiksa DUA lapis, dan keduanya perlu:
 *  1. boleh membuka menunya sama sekali, dan
 *  2. outlet yang disentuh memang outlet orang itu.
 *
 * Lapis kedua yang menggantikan "Portal Supervisor" pada berkas HTML lama.
 * Di sana siapa pun bisa memilih outlet mana saja dari dropdown lalu mengetik
 * nama — peringatan kalau namanya tidak cocok pun bisa dilewati dengan klik
 * sekali lagi. Di sini supervisor sudah masuk sebagai dirinya, dan outlet yang
 * bukan miliknya ditolak di server, bukan disembunyikan di tampilan.
 */

const bolehBuka = (u: UserProfile | null) => !!u && canReachMenu(u, "hc_kontrak");

/**
 * Apakah pengguna ini berhak menulis satu baris kontrak.
 *
 * `null` berarti baris Manajemen — kantor pusat & gudang. Ia bukan milik
 * cabang mana pun, jadi `canAccessOutlet` tidak bisa menjawabnya: yang berhak
 * adalah yang berwenang atas data HC. Dibiarkan lewat jalur outlet, satu
 * supervisor cabang akan bisa mengubah kontrak seluruh kantor pusat.
 */
function bolehTulisBaris(user: UserProfile, outletId: string | null): boolean {
  if (!outletId) return bolehUbahHc(user);
  return bolehOutlet(user, outletId);
}

/**
 * Wewenang atas satu OUTLET.
 *
 * Dipakai Update Bulanan, yang memang selalu milik cabang: laporan bulanan
 * tanpa cabang bukan laporan apa pun. Karena itu ia sengaja tidak menerima
 * `null`, dan tidak boleh disatukan dengan pemeriksaan baris kontrak.
 */
function bolehOutlet(user: UserProfile, outletId: string): boolean {
  return canAccessOutlet(user, outletId, getOutlets());
}

function segarkan() {
  revalidatePath("/hc-mos");
  revalidatePath("/hc-mos/kontrak");
}

/**
 * Jalur cadangan unggah berkas Kontrak Tracker.
 *
 * Jalur utamanya presigned URL langsung ke R2 — berkas tidak menyinggahi
 * fungsi serverless sama sekali. Ini yang dipakai hanya bila R2 sedang tidak
 * aktif, dan seluruh badannya terbungkus: aksi yang melempar galat tak
 * tertangkap muncul di layar sebagai pesan bawaan Next yang isinya disunting,
 * dan orang yang sedang mengisi data karyawan tidak bisa berbuat apa pun
 * dengan kalimat itu.
 */
export async function uploadKontrakFileAction(
  formData: FormData,
): Promise<{ path?: string; name?: string; error?: string }> {
  try {
    const user = await getSessionUser();
    if (!bolehBuka(user)) return { error: "Tidak punya akses." };
    if (!dbEnabled) return { error: "Storage belum aktif." };

    const file = formData.get("file");
    if (!(file instanceof File)) return { error: "Tidak ada berkas." };
    if (file.size > MAX_BERKAS_KONTRAK) return { error: `Berkas "${file.name}" melebihi 10 MB.` };
    if (file.type !== "application/pdf" && !file.type.startsWith("image/")) {
      return { error: `"${file.name}" harus PDF atau gambar (JPG/PNG).` };
    }

    const aman = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
    const key = `hc/kontrak/${user!.id}/${Date.now()}-${randomUUID().slice(0, 8)}-${aman}`;
    if (r2Enabled()) {
      await r2Put(key, await file.arrayBuffer(), file.type || "application/octet-stream");
      return { path: `${R2_PREFIX}${key}`, name: file.name };
    }
    const { error } = await db().storage.from("hc-documents").upload(key, file, { contentType: file.type });
    if (error) return { error: `Upload gagal: ${error.message}` };
    return { path: key, name: file.name };
  } catch (e) {
    console.error("[kontrak] unggah berkas gagal:", e);
    return { error: `Gagal mengunggah: ${e instanceof Error ? e.message : "penyimpanan tidak merespons"}.` };
  }
}

/** Batas satu berkas — sama dengan yang dijanjikan pemilih berkasnya. */
const MAX_BERKAS_KONTRAK = 10 * 1024 * 1024;

export async function simpanKontrakAction(
  input: SimpanKontrakInput,
): Promise<{ ok?: true; id?: string; error?: string }> {
  const user = await getSessionUser();
  if (!bolehBuka(user)) return { error: "Tidak punya akses." };
  if (!input.nama.trim()) return { error: "Nama karyawan wajib diisi." };
  // Outlet kosong = karyawan Manajemen, dan itu sah. Yang menentukan bukan
  // ada-tidaknya outlet, melainkan apakah orangnya berhak menulis baris itu.
  const outletId = input.outletId?.trim() || null;
  if (!bolehTulisBaris(user!, outletId)) {
    return {
      error: outletId
        ? "Outlet ini bukan tanggung jawab Anda."
        : "Hanya Human Capital yang boleh mengisi kontrak karyawan Manajemen.",
    };
  }

  // Kontrak yang berakhir sebelum dimulai hampir pasti salah ketik tanggal.
  if (input.tglMulai && input.tglBerakhir && input.tglBerakhir < input.tglMulai) {
    return { error: "Tanggal berakhir lebih awal daripada tanggal mulai." };
  }

  // Baris yang sedang diubah harus benar-benar milik outlet yang diklaim —
  // tanpa ini, id dari outlet lain bisa dititipkan bersama outletId sendiri.
  if (input.id) {
    const asal = await pemilikKontrak(input.id);
    if (!asal.ada) return { error: "Data karyawan tidak ditemukan." };
    if (!bolehTulisBaris(user!, asal.outletId)) return { error: "Data ini bukan tanggung jawab Anda." };
  }

  try {
    const { id } = await simpanKontrak(input, user!.id);
    segarkan();
    return { ok: true, id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan." };
  }
}

export async function hapusKontrakAction(id: string): Promise<{ ok?: true; error?: string }> {
  const user = await getSessionUser();
  if (!bolehBuka(user)) return { error: "Tidak punya akses." };
  try {
    const asal = await pemilikKontrak(id);
    if (!asal.ada) return { error: "Data karyawan tidak ditemukan." };
    if (!bolehTulisBaris(user!, asal.outletId)) return { error: "Data ini bukan tanggung jawab Anda." };
    await hapusKontrak(id);
    segarkan();
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menghapus." };
  }
}

export async function simpanUpdateBulananAction(input: {
  outletId: string;
  periode: string;
  jumlahKaryawan: number;
  catatan: string;
}): Promise<{ ok?: true; error?: string }> {
  const user = await getSessionUser();
  if (!bolehBuka(user)) return { error: "Tidak punya akses." };
  if (!bolehOutlet(user!, input.outletId)) return { error: "Outlet ini bukan tanggung jawab Anda." };
  if (!/^\d{4}-\d{2}$/.test(input.periode)) return { error: "Periode tidak valid." };
  if (input.jumlahKaryawan < 0) return { error: "Jumlah karyawan tidak boleh negatif." };

  try {
    await simpanUpdateBulanan({
      ...input,
      olehId: user!.id,
      olehNama: user!.name,
    });
    segarkan();
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan laporan." };
  }
}

/** Riwayat laporan bulanan satu outlet — dibuka dari dalam tabel. */
export async function riwayatUpdateAction(outletId: string): Promise<UpdateBulanan[] | { error: string }> {
  const user = await getSessionUser();
  if (!bolehBuka(user)) return { error: "Tidak punya akses." };
  if (!bolehOutlet(user!, outletId)) return { error: "Outlet ini bukan tanggung jawab Anda." };
  try {
    return await riwayatUpdateBulanan(outletId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal memuat riwayat." };
  }
}

/**
 * Ingatkan supervisor yang belum mengirim Update Bulanan.
 *
 * Berkas HTML aslinya memakai tautan `mailto:` — yang berarti membuka aplikasi
 * email di HP orang yang menekan tombolnya, lalu berharap ia benar-benar
 * mengirimnya. Di sini pengingatnya dikirim sebagai notifikasi di dalam sistem,
 * langsung ke akun supervisornya: ia sudah membuka aplikasi ini tiap hari untuk
 * hygiene dan komplain, dan notifikasinya membawa tautan yang begitu diklik
 * mendarat tepat di Kontrak Tracker. Tidak ada layanan email baru yang perlu
 * dibayar, dan tidak ada pengingat yang berhenti di kotak keluar seseorang.
 *
 * Outlet yang supervisornya belum terdaftar dilewati dan dilaporkan apa adanya
 * — mengaku "terkirim" untuk penerima yang tidak ada adalah kebohongan kecil
 * yang membuat kepatuhan terlihat sedang diurus padahal tidak.
 */
export async function kirimPengingatAction(input: {
  periode: string;
  /** Kosongkan untuk mengingatkan SEMUA outlet yang belum melapor. */
  outletId?: string;
}): Promise<{ ok?: true; terkirim?: number; tanpaSupervisor?: number; error?: string }> {
  const user = await getSessionUser();
  if (!bolehBuka(user)) return { error: "Tidak punya akses." };

  try {
    const rekap = await rekapOutlet(user!, input.periode);
    const sasaran = rekap.filter(
      (o) => !o.sudahLapor && (!input.outletId || o.id === input.outletId),
    );
    if (sasaran.length === 0) return { error: "Tidak ada outlet yang perlu diingatkan." };

    const punyaSpv = sasaran.filter((o) => o.supervisorId);
    await Promise.all(
      punyaSpv.map((o) =>
        notify({
          kind: "hc_update_due",
          title: `Update Bulanan ${periodeLabel(input.periode)} belum masuk`,
          message: `${o.name} belum mengirim laporan bulanan. Isi jumlah karyawan aktif dan catatannya lewat Kontrak Tracker.`,
          href: "/hc-mos/kontrak",
          targetUser: o.supervisorId,
          actorName: user!.name,
          outletId: o.id,
          severity: "warning",
        }),
      ),
    );

    segarkan();
    return {
      ok: true,
      terkirim: punyaSpv.length,
      tanpaSupervisor: sasaran.length - punyaSpv.length,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal mengirim pengingat." };
  }
}
