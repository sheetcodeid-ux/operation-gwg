"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { canOpenMenu } from "@/lib/nav";
import { clearIngredientAlert, deleteIngredient, upsertIngredient, type IngredientDraft } from "@/lib/data/hpp-ingredients";
import type { UserProfile } from "@/lib/types";

/** Same access as the HPP calculator: R&D roles, admin, grants, or R&D/F&B dept. */
function allowed(user: UserProfile | null): user is UserProfile {
  if (!user) return false;
  return canOpenMenu(user.role, "hpp", user.grants) || user.department === "R&D" || user.department === "Food & Beverage";
}

function revalidate() {
  revalidatePath("/rnd/hpp/bahan");
  revalidatePath("/rnd/hpp");
}

export async function saveIngredientAction(input: IngredientDraft) {
  const user = await getSessionUser();
  if (!allowed(user)) return { error: "Not authorized" };
  if (!input.name.trim()) return { error: "Nama bahan wajib diisi." };
  const { rec, priceJump } = await upsertIngredient({ ...input, name: input.name.trim() }, user.id);
  revalidate();
  return { ok: true, id: rec.id, priceJump };
}

export async function deleteIngredientAction(id: string) {
  const user = await getSessionUser();
  if (!allowed(user)) return { error: "Not authorized" };
  await deleteIngredient(id);
  revalidate();
  return { ok: true };
}

export async function clearIngredientAlertAction(id: string) {
  const user = await getSessionUser();
  if (!allowed(user)) return { error: "Not authorized" };
  await clearIngredientAlert(id);
  revalidate();
  return { ok: true };
}
