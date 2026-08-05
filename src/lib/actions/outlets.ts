"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getAreas, getOutlets, getUsers } from "@/lib/data/store";
import { createArea, createOutlet } from "@/lib/data/mutations";
import { persistMessage } from "@/lib/data/persist";
import { esbConfigured, esbListBranches } from "@/lib/integrations/esb-client";

/** Compare branch names loosely — ESB spacing/punctuation differs from what was
 *  typed into the app, and we must never create a duplicate of an existing one. */
const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Holding area for freshly-synced POS branches.
 *  `outlets.area_id`, `pic_id` and `supervisor_id` are all FOREIGN KEYS, so a
 *  new outlet cannot be saved with blanks — that is what made the first sync
 *  fail with "Gagal menyimpan ke database". New branches land here until an
 *  admin assigns the real area. */
const UNASSIGNED_AREA = "Belum Ditentukan";

async function unassignedAreaId(adminId: string): Promise<string> {
  const existing = getAreas().find((a) => a.name === UNASSIGNED_AREA);
  if (existing) return existing.id;
  const created = await createArea({ name: UNASSIGNED_AREA, code: "AR-UNSET", coordinatorId: adminId });
  return created.id;
}

export interface AssignableOutlet {
  id: string;
  name: string;
}

/**
 * Outlets a Coordinator Area / Supervisor may be assigned, sourced from the POS
 * (ESB branches API) so new POS outlets show up automatically — falling
 * back to the local outlets table when the integration isn't configured/
 * reachable. Outlets already held by ANOTHER user of the SAME role are removed
 * (exclusive assignment): coordinators don't clash with coordinators, and
 * supervisors don't clash with supervisors. Pass the edited user's id so their
 * own current outlets stay selectable.
 */
export async function listAssignableOutlets(
  role: "area_coordinator" | "supervisor" = "area_coordinator",
  excludeUserId?: string,
): Promise<{ ok: true; outlets: AssignableOutlet[]; source: "pos" | "local" } | { error: string }> {
  const admin = await getSessionUser();
  if (!admin || !can(admin, "manage_users")) return { error: "Not authorized" };

  // Use the APP's outlets as the source of truth so an assigned id matches what
  // the operational modules (Hygiene/Hospitality/Dashboard) read via
  // scopeOutlets. Assigning a POS-only id (a branch code) would scope to nothing.
  // POS is only a fallback when the app has no outlets synced yet.
  const appOutlets = getOutlets();
  // POS code → app id, so a "taken" outlet held by its POS code still excludes
  // the matching app outlet (older assignments stored the branch code).
  const codeToId = new Map<string, string>();
  for (const o of appOutlets) if (o.code) codeToId.set(o.code, o.id);

  let all: AssignableOutlet[] = appOutlets.map((o) => ({ id: o.id, name: o.name }));
  let source: "pos" | "local" = "local";
  if (esbConfigured()) {
    try {
      const branches = await esbListBranches();
      if (all.length === 0) {
        // Nothing synced yet — offer POS branches directly.
        all = branches.map((b) => ({ id: b.id, name: b.name })).filter((o) => o.id && o.name);
        source = "pos";
      } else {
        // Adopt any branch the app is missing (e.g. a newly opened outlet) so the
        // picker always matches the POS — the promise this dialog makes to the
        // admin. Additive only; existing outlets are never touched.
        const known = new Set(appOutlets.map((o) => normName(o.name)));
        const missing = branches.filter((b) => (b.name ?? "").trim() && !known.has(normName((b.name ?? "").trim())));
        const areaId = missing.length > 0 ? await unassignedAreaId(admin.id) : "";
        for (const b of missing) {
          const name = (b.name ?? "").trim();
          if (known.has(normName(name))) continue;
          try {
            const created = await createOutlet({ name, code: b.id ?? "", city: "", areaId, picId: admin.id });
            known.add(normName(name));
            all.push({ id: created.id, name: created.name });
          } catch {
            /* keep the picker usable even if one insert fails */
          }
        }
      }
    } catch {
      /* POS unreachable — fall back to whatever the app already has */
    }
  }

  // Exclude outlets already assigned to another user of the same role. An
  // assignment may store the app id or the POS code, so normalise both to the
  // app id before comparing.
  const taken = new Set<string>();
  for (const u of getUsers()) {
    if (u.role === role && u.id !== excludeUserId) {
      for (const oid of u.outletIds ?? []) taken.add(codeToId.get(oid) ?? oid);
    }
  }

  // De-dupe by id, drop taken, sort by name.
  const seen = new Set<string>();
  const outlets = all
    .filter((o) => !taken.has(o.id) && !seen.has(o.id) && seen.add(o.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { ok: true, outlets, source };
}

export interface OutletSyncResult {
  added: string[];
  skipped: number;
  esbTotal: number;
  error?: string;
}

/**
 * Pull the branch list from ESB (the POS source of truth) and add every branch
 * the app doesn't have yet — so User Management, Work Tracker and every outlet
 * picker stop lagging behind the POS.
 *
 * ADDITIVE on purpose: outlets are referenced by tasks, complaints, hygiene and
 * more, so nothing is renamed or removed here. New outlets arrive without an
 * area; assign it afterwards so Coordinator-Area scoping stays correct.
 */
export async function syncOutletsFromEsbAction(): Promise<OutletSyncResult> {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "super_admin") {
    return { added: [], skipped: 0, esbTotal: 0, error: "Hanya Admin yang dapat menyinkronkan cabang." };
  }
  if (!esbConfigured()) {
    return { added: [], skipped: 0, esbTotal: 0, error: "Integrasi ESB belum dikonfigurasi." };
  }
  try {
    const branches = await esbListBranches();
    if (branches.length === 0) {
      return { added: [], skipped: 0, esbTotal: 0, error: "ESB tidak mengembalikan daftar cabang. Cek koneksi / kredensial ESB." };
    }
    const existing = new Set(getOutlets().map((o) => normName(o.name)));
    const added: string[] = [];
    let skipped = 0;
    const missing = branches.filter((b) => (b.name ?? "").trim() && !existing.has(normName((b.name ?? "").trim())));
    skipped = branches.length - missing.length;
    const areaId = missing.length > 0 ? await unassignedAreaId(admin.id) : "";
    for (const b of missing) {
      const name = (b.name ?? "").trim();
      if (existing.has(normName(name))) continue;
      await createOutlet({ name, code: b.id ?? "", city: "", areaId, picId: admin.id });
      existing.add(normName(name));
      added.push(name);
    }
    revalidatePath("/outlets");
    revalidatePath("/work-tracker");
    revalidatePath("/admin/users");
    return { added, skipped, esbTotal: branches.length };
  } catch (e) {
    return { added: [], skipped: 0, esbTotal: 0, error: persistMessage(e) };
  }
}
