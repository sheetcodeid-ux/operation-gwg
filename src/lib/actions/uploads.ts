"use server";

import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { presignPut, r2Enabled, R2_PREFIX } from "@/lib/storage/r2";

export interface PresignItem {
  /** Stored as the Attachment id (with the r2: prefix). */
  id: string;
  /** Raw object key (for reference). */
  key: string;
  /** Short-lived presigned PUT URL the browser uploads to. */
  url: string;
}

/**
 * Issue presigned PUT URLs so the browser can upload hygiene photos straight to
 * R2 (bypassing Vercel). Returns `{ mode: "none" }` when R2 isn't configured so
 * the client falls back to the Supabase path.
 */
export async function presignHygieneUploadsAction(files: { name: string; type: string }[]) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" } as const;
  if (!can(user, "create_hygiene")) return { error: "No permission" } as const;
  if (!r2Enabled()) return { mode: "none" } as const;
  if (files.length === 0) return { mode: "r2", items: [] as PresignItem[] } as const;
  if (files.length > 30) return { error: "Terlalu banyak foto dalam satu batch." } as const;

  const items: PresignItem[] = [];
  for (const f of files) {
    if (!f.type.startsWith("image/")) return { error: `"${f.name}" bukan gambar.` } as const;
    const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-50);
    const key = `hygiene/${user.id}/${Date.now()}-${randomUUID().slice(0, 8)}-${safe}`;
    const url = await presignPut(key, f.type, 600);
    items.push({ id: `${R2_PREFIX}${key}`, key, url });
  }
  return { mode: "r2", items } as const;
}
