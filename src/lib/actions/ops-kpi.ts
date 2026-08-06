"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { canUseOpsFinance as canInput } from "@/lib/ops/access";
import { canReachMenu } from "@/lib/nav";
import { upsertPnl } from "@/lib/data/ops-pnl";
import { getOpsKpiBoard, saveOpsKpiManual, saveOpsKpiWeights, type OpsKpiBoard } from "@/lib/data/ops-kpi";
import type { PnlRow } from "@/lib/ops/categories";
import type { OpsKpiKey } from "@/lib/ops-kpi";
import type { UserProfile } from "@/lib/types";

const canSeeKpi = (u: UserProfile | null) => !!u && canReachMenu(u, "op_kpi");

function revalidate() {
  revalidatePath("/operation/laba-rugi");
  revalidatePath("/operation/kpi");
  revalidatePath("/dashboard");
}

export async function savePnlAction(month: string, rows: PnlRow[]) {
  const user = await getSessionUser();
  if (!canInput(user)) return { error: "Tidak berwenang." };
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Bulan tidak valid." };
  try {
    const n = await upsertPnl(month, rows);
    revalidate();
    return { ok: true, count: n };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan." };
  }
}

export async function getOpsKpiBoardAction(period: string, areaId: string): Promise<OpsKpiBoard | { error: string }> {
  const user = await getSessionUser();
  if (!canSeeKpi(user)) return { error: "Tidak punya akses." };
  if (!/^\d{4}-\d{2}$/.test(period)) return { error: "Periode tidak valid." };
  try {
    return await getOpsKpiBoard(period, areaId, user!);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal memuat KPI." };
  }
}

export async function saveOpsKpiManualAction(input: {
  period: string;
  areaId: string;
  problemSolver: number;
  problemSolverTarget: number;
  complaintTarget: number;
  note: string;
}) {
  const user = await getSessionUser();
  if (!canSeeKpi(user)) return { error: "Tidak punya akses." };
  if (!/^\d{4}-\d{2}$/.test(input.period)) return { error: "Periode tidak valid." };
  if (input.problemSolver < 0 || input.problemSolverTarget < 0 || input.complaintTarget < 0) {
    return { error: "Nilai tidak boleh negatif." };
  }
  try {
    await saveOpsKpiManual({ ...input, updatedBy: user!.id });
    revalidate();
    return { ok: true as const };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan." };
  }
}

export async function saveOpsKpiWeightsAction(weights: Record<OpsKpiKey, number>) {
  const user = await getSessionUser();
  if (!canSeeKpi(user)) return { error: "Tidak punya akses." };
  const total = Object.values(weights).reduce((a, b) => a + (Number(b) || 0), 0);
  if (Math.round(total) !== 100) return { error: `Total bobot harus 100% — sekarang ${total}%.` };
  try {
    await saveOpsKpiWeights(weights);
    revalidate();
    return { ok: true as const };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan bobot." };
  }
}
