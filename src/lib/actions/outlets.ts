"use server";

import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getOutlets, getUsers } from "@/lib/data/store";
import { fetchBranches, gwgmanageConfigured } from "@/lib/integrations/gwgmanage";

export interface AssignableOutlet {
  id: string;
  name: string;
}

/**
 * Outlets a Coordinator Area may be assigned, sourced from the POS (gwgmanage
 * branches API) so new POS outlets show up automatically — falling back to the
 * local outlets table when the integration isn't configured/reachable. Outlets
 * already held by ANOTHER area coordinator are removed (exclusive assignment);
 * pass the edited user's id so their own current outlets stay selectable.
 */
export async function listCoordinatorOutlets(
  excludeUserId?: string,
): Promise<{ ok: true; outlets: AssignableOutlet[]; source: "pos" | "local" } | { error: string }> {
  const admin = await getSessionUser();
  if (!admin || !can(admin, "manage_users")) return { error: "Not authorized" };

  let all: AssignableOutlet[] = [];
  let source: "pos" | "local" = "local";
  if (gwgmanageConfigured()) {
    try {
      const branches = await fetchBranches();
      all = branches
        .map((b) => ({ id: b.code || String(b.branchId || b.id), name: b.name }))
        .filter((o) => o.id && o.name);
      source = "pos";
    } catch {
      all = [];
    }
  }
  if (all.length === 0) {
    all = getOutlets().map((o) => ({ id: o.id, name: o.name }));
    source = "local";
  }

  // Exclude outlets already assigned to another coordinator.
  const taken = new Set<string>();
  for (const u of getUsers()) {
    if (u.role === "area_coordinator" && u.id !== excludeUserId) {
      for (const oid of u.outletIds ?? []) taken.add(oid);
    }
  }

  // De-dupe by id, drop taken, sort by name.
  const seen = new Set<string>();
  const outlets = all
    .filter((o) => !taken.has(o.id) && !seen.has(o.id) && seen.add(o.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { ok: true, outlets, source };
}
