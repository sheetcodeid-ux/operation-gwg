"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { canUseOpsFinance as canInput } from "@/lib/ops/access";
import { upsertExpenses, upsertPurchases, type ExpenseRow, type PurchaseRow } from "@/lib/data/ops-finance";

function revalidate() {
  revalidatePath("/operation/beban");
  revalidatePath("/operation/pembelian");
  revalidatePath("/dashboard");
}

export async function saveExpensesAction(month: string, rows: ExpenseRow[]) {
  const user = await getSessionUser();
  if (!canInput(user)) return { error: "Tidak berwenang." };
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Bulan tidak valid." };
  try {
    const n = await upsertExpenses(month, rows);
    revalidate();
    return { ok: true, count: n };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan." };
  }
}

export async function savePurchasesAction(month: string, rows: PurchaseRow[]) {
  const user = await getSessionUser();
  if (!canInput(user)) return { error: "Tidak berwenang." };
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Bulan tidak valid." };
  try {
    const n = await upsertPurchases(month, rows);
    revalidate();
    return { ok: true, count: n };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan." };
  }
}
