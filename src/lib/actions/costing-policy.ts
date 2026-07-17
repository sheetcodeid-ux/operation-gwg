"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { canVerifyHpp } from "@/lib/hpp/access";
import { persistMessage } from "@/lib/data/persist";
import { deleteCostingPolicy, saveCostingPolicy } from "@/lib/data/costing-policy";

/** Only the HPP verifier (R&D Head / Super Admin) may change costing policy —
 *  it is a company-wide baseline, not a per-user preference. */
export async function saveCostingPolicyAction(input: {
  scope: string;
  foodPct: number;
  bevPct: number;
  foodMarginMin: number;
  foodMarginMax: number;
  bevMarginMin: number;
  bevMarginMax: number;
}) {
  const user = await getSessionUser();
  if (!user || !canVerifyHpp(user)) return { error: "Hanya Head R&D / Admin yang dapat mengubah kebijakan costing." };
  try {
    const { scope, ...rest } = input;
    await saveCostingPolicy(scope, rest);
    revalidatePath("/rnd/hpp");
    return { ok: true };
  } catch (e) {
    return { error: persistMessage(e) };
  }
}

export async function deleteCostingPolicyAction(scope: string) {
  const user = await getSessionUser();
  if (!user || !canVerifyHpp(user)) return { error: "Hanya Head R&D / Admin yang dapat mengubah kebijakan costing." };
  try {
    await deleteCostingPolicy(scope);
    revalidatePath("/rnd/hpp");
    return { ok: true };
  } catch (e) {
    return { error: persistMessage(e) };
  }
}
