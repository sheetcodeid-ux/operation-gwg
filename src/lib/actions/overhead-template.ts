"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { canUseHpp } from "@/lib/hpp/access";
import { persistMessage } from "@/lib/data/persist";
import {
  deleteOverheadTemplate,
  saveOverheadTemplate,
  type OverheadTemplateItem,
} from "@/lib/data/overhead-template";

/** Anyone who can edit HPP may save/apply overhead templates — they are a
 *  convenience for building calculations, not a company-wide policy. */
export async function saveOverheadTemplateAction(input: {
  name: string;
  brand?: string | null;
  items: OverheadTemplateItem[];
}) {
  const user = await getSessionUser();
  if (!canUseHpp(user)) return { error: "Not authorized" };
  try {
    const rec = await saveOverheadTemplate({ ...input, createdBy: user.id });
    revalidatePath("/rnd/hpp");
    return { ok: true, id: rec.id };
  } catch (e) {
    return { error: persistMessage(e) };
  }
}

export async function deleteOverheadTemplateAction(id: string) {
  const user = await getSessionUser();
  if (!canUseHpp(user)) return { error: "Not authorized" };
  try {
    await deleteOverheadTemplate(id);
    revalidatePath("/rnd/hpp");
    return { ok: true };
  } catch (e) {
    return { error: persistMessage(e) };
  }
}
