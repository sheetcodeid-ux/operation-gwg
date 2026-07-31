"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { canUseHpp } from "@/lib/hpp/access";
import { esbConfigured } from "@/lib/integrations/esb-client";
import { listEsbMenus } from "@/lib/data/esb-menu";
import { saveSales, type MenuPerformanceRow } from "@/lib/data/hpp-sales";

/** Current month as YYYY-MM (server local time). */
function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Refresh a month's actual menu sales into `hpp_sales` from the ESB catalog
 * (`esb_menu`, kept fresh by the hourly cron). Reading the already-synced
 * catalog is instant — no slow live ESB export — so the R&D dashboard's
 * actual-vs-projection panel updates immediately. Guarded to R&D / F&B users.
 */
export async function syncSalesAction(month?: string) {
  const user = await getSessionUser();
  if (!canUseHpp(user)) return { error: "Not authorized" };
  if (!esbConfigured()) {
    return { error: "Integrasi ESB belum dikonfigurasi. Set ESB_USERNAME & ESB_PASSWORD." };
  }
  const m = /^\d{4}-\d{2}$/.test(month ?? "") ? month! : thisMonth();
  try {
    const menus = await listEsbMenus();
    if (!menus.length) {
      return { error: "Katalog ESB belum tersinkron — coba lagi beberapa saat lagi (sinkron otomatis tiap jam)." };
    }
    const rows: MenuPerformanceRow[] = menus.map((mn) => ({
      menuName: mn.menu,
      categoryName: mn.category || null,
      category: mn.categoryDetail || null,
      qty: mn.qty30d,
      amount: Math.round(mn.qty30d * (mn.unitPrice || 0)),
      volume: null,
      omzet: null,
      keterangan: null,
    }));
    const syncedAt = new Date().toISOString();
    const count = await saveSales(m, rows, syncedAt);
    revalidatePath("/rnd/dashboard");
    return { ok: true, month: m, count, syncedAt };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal membaca katalog ESB.";
    return { error: msg };
  }
}
