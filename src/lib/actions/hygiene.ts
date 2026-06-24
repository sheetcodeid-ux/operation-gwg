"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { can, canAccessOutlet } from "@/lib/rbac";
import { getOutlet, getOutlets, userName } from "@/lib/data/store";
import { createHygiene } from "@/lib/data/mutations";
import type { HygieneRating, HygieneSection } from "@/lib/types";

export interface HygieneInput {
  outletId: string;
  shift: string;
  inspectorName: string;
  ratings: Record<HygieneSection, Record<string, HygieneRating>>;
  findings: string[];
  isClean: boolean;
}

export async function createHygieneAction(input: HygieneInput) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!can(user, "create_hygiene")) return { error: "You don't have permission to create audits." };
  if (!canAccessOutlet(user, input.outletId, getOutlets())) return { error: "Outlet is outside your scope." };

  const outlet = getOutlet(input.outletId)!;
  const record = createHygiene({
    outletId: input.outletId,
    shift: input.shift,
    inspectorName: input.inspectorName.trim() || user.name,
    supervisorName: userName(outlet.supervisorId),
    ratings: input.ratings,
    findings: input.findings.filter((f) => f.trim()),
    isClean: input.isClean,
  });

  revalidatePath("/hygiene");
  revalidatePath("/dashboard");
  return { ok: true, id: record.id, score: record.hygieneScore };
}
