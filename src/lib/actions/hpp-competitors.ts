"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { canUseHpp } from "@/lib/hpp/access";
import { deleteCompetitorPrice, saveCompetitorPrice, type CompetitorDraft } from "@/lib/data/hpp-competitors";

function revalidate() {
  revalidatePath("/rnd/hpp/kompetitor");
  revalidatePath("/rnd/dashboard");
}

export async function saveCompetitorPriceAction(input: CompetitorDraft) {
  const user = await getSessionUser();
  if (!canUseHpp(user)) return { error: "Not authorized" };
  if (!input.menuName.trim()) return { error: "Nama menu wajib diisi." };
  if (!input.competitor.trim()) return { error: "Nama kompetitor wajib diisi." };
  if (!(input.price > 0)) return { error: "Harga kompetitor harus lebih dari 0." };

  const rec = await saveCompetitorPrice(
    {
      ...input,
      menuName: input.menuName.trim(),
      competitor: input.competitor.trim(),
      city: input.city?.trim() || null,
      source: input.source?.trim() || null,
      note: input.note?.trim() || null,
    },
    user.id,
  );
  revalidate();
  return { ok: true, id: rec.id };
}

export async function deleteCompetitorPriceAction(id: string) {
  const user = await getSessionUser();
  if (!canUseHpp(user)) return { error: "Not authorized" };
  await deleteCompetitorPrice(id);
  revalidate();
  return { ok: true };
}
