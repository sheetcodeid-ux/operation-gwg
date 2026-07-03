"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { createArea, createOutlet } from "@/lib/data/mutations";
import { createAreaSchema, createOutletSchema, parseInput } from "@/lib/validation";

export async function createAreaAction(input: { name: string; code: string; coordinatorId: string }) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!can(user, "manage_org")) return { error: "No permission" };
  const parsed = parseInput(createAreaSchema, input);
  if ("error" in parsed) return { error: parsed.error };
  const clean = parsed.data;
  createArea({ name: clean.name, code: clean.code.toUpperCase(), coordinatorId: clean.coordinatorId || user.id });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function createOutletAction(input: { name: string; code: string; city: string; areaId: string; picId: string }) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!can(user, "manage_org")) return { error: "No permission" };
  const parsed = parseInput(createOutletSchema, input);
  if ("error" in parsed) return { error: parsed.error };
  const clean = parsed.data;
  createOutlet({
    name: clean.name,
    code: clean.code.toUpperCase() || clean.name.slice(0, 6).toUpperCase(),
    city: clean.city || "-",
    areaId: clean.areaId,
    picId: clean.picId || user.id,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
