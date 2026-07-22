"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { can, canAccessOutlet } from "@/lib/rbac";
import { getOutlets } from "@/lib/data/store";
import { createComplaint, resolveComplaint } from "@/lib/data/mutations";
import { persistMessage } from "@/lib/data/persist";
import { complaintInputSchema, parseInput, resolveComplaintSchema } from "@/lib/validation";
import type {
  ComplaintCategory,
  ComplaintSource,
  ComplaintStatus,
  RootCauseCategory,
} from "@/lib/types";

export interface ComplaintInput {
  source: ComplaintSource;
  customerName: string;
  rating?: number | null;
  content: string;
  outletId: string;
  category: ComplaintCategory;
}

export async function createComplaintAction(input: ComplaintInput) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!can(user, "manage_complaint")) return { error: "You don't have permission to log complaints." };
  const parsed = parseInput(complaintInputSchema, input);
  if ("error" in parsed) return { error: parsed.error };
  const clean = parsed.data;
  if (!canAccessOutlet(user, clean.outletId, getOutlets())) return { error: "Outlet is outside your scope." };

  let record;
  try {
    record = await createComplaint({
      source: clean.source,
      customerName: clean.customerName || "Anonymous",
      rating: clean.source === "google_review" ? clean.rating ?? null : null,
      content: clean.content,
      outletId: clean.outletId,
      category: clean.category,
    });
  } catch (e) {
    return { error: persistMessage(e) };
  }

  revalidatePath("/complaints");
  revalidatePath("/dashboard");
  return { ok: true, id: record.id };
}

export interface ResolveInput {
  id: string;
  status: ComplaintStatus;
  rootCause?: RootCauseCategory;
  actionDescription?: string;
  followUpDate?: string;
}

export async function bulkCloseComplaintsAction(ids: string[]) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!can(user, "manage_complaint")) return { error: "No permission" };
  for (const id of ids) resolveComplaint({ id, status: "close" });
  revalidatePath("/complaints");
  revalidatePath("/dashboard");
  return { ok: true, count: ids.length };
}

export async function resolveComplaintAction(input: ResolveInput) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!can(user, "manage_complaint")) return { error: "No permission" };
  const parsed = parseInput(resolveComplaintSchema, input);
  if ("error" in parsed) return { error: parsed.error };
  const clean = parsed.data;

  resolveComplaint({
    id: clean.id,
    status: clean.status,
    rootCause: clean.rootCause,
    correctiveAction: clean.actionDescription
      ? {
          actionDate: new Date().toISOString(),
          picId: user.id,
          description: clean.actionDescription,
          followUpDate: clean.followUpDate ? new Date(clean.followUpDate).toISOString() : null,
        }
      : undefined,
  });

  revalidatePath("/complaints");
  revalidatePath("/dashboard");
  return { ok: true };
}
