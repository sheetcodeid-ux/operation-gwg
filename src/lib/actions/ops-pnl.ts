"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { canUseOpsFinance as canInput } from "@/lib/ops/access";
import { upsertPnl } from "@/lib/data/ops-pnl";
import type { PnlRow } from "@/lib/ops/categories";

/**
 * Simpan laba rugi satu bulan.
 *
 * Laba Rugi berdiri sendiri sebagai modul input keuangan Operation: yang
 * disimpan di sini dibaca dashboard dan halaman Laba Rugi, tanpa bergantung
 * pada modul lain.
 */
export async function savePnlAction(month: string, rows: PnlRow[]) {
  const user = await getSessionUser();
  if (!canInput(user)) return { error: "Tidak berwenang." };
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Bulan tidak valid." };
  try {
    const n = await upsertPnl(month, rows);
    revalidatePath("/operation/laba-rugi");
    revalidatePath("/dashboard");
    return { ok: true, count: n };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan." };
  }
}
