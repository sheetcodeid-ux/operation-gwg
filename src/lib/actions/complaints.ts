"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { can, canAccessOutlet } from "@/lib/rbac";
import { getOutlets } from "@/lib/data/store";
import { createComplaint, resolveComplaint } from "@/lib/data/mutations";
import type {
  ComplaintCategory,
  ComplaintSource,
  ComplaintStatus,
  Priority,
  RootCauseCategory,
} from "@/lib/types";

export interface ComplaintInput {
  source: ComplaintSource;
  customerName: string;
  rating?: number | null;
  content: string;
  outletId: string;
  category: ComplaintCategory;
  priority: Priority;
}

export async function createComplaintAction(input: ComplaintInput) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!can(user, "manage_complaint")) return { error: "You don't have permission to log complaints." };
  if (!input.content.trim()) return { error: "Complaint content is required." };
  if (!canAccessOutlet(user, input.outletId, getOutlets())) return { error: "Outlet is outside your scope." };

  const record = createComplaint({
    source: input.source,
    customerName: input.customerName.trim() || "Anonymous",
    rating: input.source === "google_review" ? input.rating ?? null : null,
    content: input.content.trim(),
    outletId: input.outletId,
    category: input.category,
    priority: input.priority,
  });

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

export async function resolveComplaintAction(input: ResolveInput) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!can(user, "manage_complaint")) return { error: "No permission" };

  resolveComplaint({
    id: input.id,
    status: input.status,
    rootCause: input.rootCause,
    correctiveAction: input.actionDescription
      ? {
          actionDate: new Date().toISOString(),
          picId: user.id,
          description: input.actionDescription.trim(),
          followUpDate: input.followUpDate ? new Date(input.followUpDate).toISOString() : null,
        }
      : undefined,
  });

  revalidatePath("/complaints");
  revalidatePath("/dashboard");
  return { ok: true };
}
