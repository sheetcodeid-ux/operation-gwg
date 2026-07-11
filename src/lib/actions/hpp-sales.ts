"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { canUseHpp } from "@/lib/hpp/access";
import { fetchMenuPerformance, gwgmanageConfigured } from "@/lib/integrations/gwgmanage";
import { saveSales } from "@/lib/data/hpp-sales";

/** Current month as YYYY-MM (server local time). */
function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Pull actual menu sales from GWG Manage (gwgmanage.com) for a month and store
 * them in `hpp_sales`. Guarded to R&D / F&B users. Returns the row count synced
 * or a friendly error (never leaks credentials).
 */
export async function syncSalesAction(month?: string) {
  const user = await getSessionUser();
  if (!canUseHpp(user)) return { error: "Not authorized" };
  if (!gwgmanageConfigured()) {
    return { error: "Integrasi GWG Manage belum dikonfigurasi. Set GWGMANAGE_EMAIL & GWGMANAGE_PASSWORD di Vercel." };
  }
  const m = /^\d{4}-\d{2}$/.test(month ?? "") ? month! : thisMonth();
  try {
    const perf = await fetchMenuPerformance(m);
    const syncedAt = new Date().toISOString();
    const count = await saveSales(m, perf.menus, syncedAt);
    revalidatePath("/rnd/dashboard");
    return { ok: true, month: m, count, syncedAt };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal menyambung ke GWG Manage.";
    return { error: msg };
  }
}
