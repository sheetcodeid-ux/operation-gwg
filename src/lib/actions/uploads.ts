"use server";

import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { canReachMenu, type MenuKey } from "@/lib/nav";
import { presignPut, r2Enabled, R2_PREFIX } from "@/lib/storage/r2";

export interface PresignItem {
  /** Stored as the Attachment id (with the r2: prefix). */
  id: string;
  /** Raw object key (for reference). */
  key: string;
  /** Short-lived presigned PUT URL the browser uploads to. */
  url: string;
}

/**
 * Issue presigned PUT URLs so the browser can upload hygiene photos straight to
 * R2 (bypassing Vercel). Returns `{ mode: "none" }` when R2 isn't configured so
 * the client falls back to the Supabase path.
 */
export async function presignHygieneUploadsAction(files: { name: string; type: string }[]) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" } as const;
  if (!can(user, "create_hygiene")) return { error: "No permission" } as const;
  if (!r2Enabled()) return { mode: "none" } as const;
  if (files.length === 0) return { mode: "r2", items: [] as PresignItem[] } as const;
  if (files.length > 30) return { error: "Terlalu banyak foto dalam satu batch." } as const;

  const items: PresignItem[] = [];
  for (const f of files) {
    if (!f.type.startsWith("image/")) return { error: `"${f.name}" bukan gambar.` } as const;
    const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-50);
    const key = `hygiene/${user.id}/${Date.now()}-${randomUUID().slice(0, 8)}-${safe}`;
    // 10 menit terlalu mepet: audit penuh 20+ foto dari HP di lapangan bisa
    // melewatinya, dan URL yang kedaluwarsa di tengah jalan menggagalkan sisanya.
    const url = await presignPut(key, f.type, 3600);
    items.push({ id: `${R2_PREFIX}${key}`, key, url });
  }
  return { mode: "r2", items } as const;
}

/**
 * Presigned PUT untuk lampiran modul mana pun.
 *
 * Berkas besar tidak boleh melewati server action: badan permintaan menuju
 * fungsi serverless dibatasi beberapa MB dan ditolak di lapisan platform —
 * sebelum kode kita sempat jalan — sehingga yang terlihat pengguna hanyalah
 * "an unexpected response was received from the server", bukan pesan kita.
 * Pola ini sudah dipakai foto Hygiene; di sini disediakan untuk sisanya.
 */
export type UploadScope = "hcdoc" | "marcomm" | "system" | "kontrak";

const SCOPE_MENUS: Record<UploadScope, MenuKey[]> = {
  hcdoc: ["hc_submit", "hc_review"],
  // Berkas kontrak, KTP, dan foto karyawan di Kontrak Tracker. Menu yang sama
  // dengan halamannya: yang boleh membukanya boleh mengunggah ke dalamnya, dan
  // hak menulis baris tertentu diperiksa lagi saat menyimpan.
  kontrak: ["hc_kontrak"],
  marcomm: ["mc_events", "events"],
  system: ["sys_submit", "sys_review"],
};

const SCOPE_PREFIX: Record<UploadScope, string> = {
  hcdoc: "hc",
  kontrak: "hc/kontrak",
  marcomm: "marcomm",
  system: "system",
};

/** Maks 10 MB — sama dengan batas yang dijanjikan tiap modul. */
const PRESIGN_MAX = 10 * 1024 * 1024;

export async function presignAttachmentAction(input: {
  scope: UploadScope;
  name: string;
  contentType: string;
  size: number;
}): Promise<{ url?: string; path?: string; error?: string; unavailable?: true }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  const menus = SCOPE_MENUS[input.scope];
  if (!menus) return { error: "Tujuan unggahan tidak dikenal." };
  if (!menus.some((m) => canReachMenu(user, m))) return { error: "Tidak punya akses." };
  // R2 mati ⇒ pemanggil memakai jalur server action seperti biasa.
  if (!r2Enabled()) return { unavailable: true };
  if (input.size > PRESIGN_MAX) return { error: `Berkas "${input.name}" melebihi 10 MB.` };
  if (input.contentType !== "application/pdf" && !input.contentType.startsWith("image/")) {
    return { error: `"${input.name}" harus PDF atau gambar (JPG/PNG).` };
  }

  const safe = input.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  const key = `${SCOPE_PREFIX[input.scope]}/${user.id}/${Date.now()}-${randomUUID().slice(0, 8)}-${safe}`;
  try {
    const url = await presignPut(key, input.contentType || "application/octet-stream");
    return { url, path: `${R2_PREFIX}${key}` };
  } catch (e) {
    console.error("[uploads] gagal menandatangani URL unggah:", e);
    return { error: "Gagal menyiapkan unggahan." };
  }
}
