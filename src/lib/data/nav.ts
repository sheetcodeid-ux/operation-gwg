import "server-only";

import { db, dbEnabled } from "./db";
import { navDivisionId, type NavExtra, type NavExtraGroup, type MenuKey } from "@/lib/nav";

/** Admin-managed extra sidebar divisions (grup menu di sidebar), stored in the
 *  DB and merged on top of the built-in navigation. In demo mode (no DB) they
 *  live in memory. Never alters built-in divisions — purely additive. */

interface DivRow {
  id: string;
  name: string;
  icon: string;
  menus: string[];
}

interface GroupRow {
  id: string;
  division: string;
  name: string;
  icon: string;
  menus: string[];
  position: number;
}

const memDivs = new Map<string, DivRow>();
const memGroups = new Map<string, GroupRow>();

/** Stable id for one sub-group inside a division. */
export const navGroupId = (division: string, name: string) =>
  `grp_${`${division}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

const toGroup = (r: GroupRow): NavExtraGroup => ({
  division: r.division,
  name: r.name,
  icon: r.icon,
  menus: (r.menus ?? []) as MenuKey[],
});

export async function getNavExtra(): Promise<NavExtra> {
  if (!dbEnabled) {
    return {
      divisions: [...memDivs.values()].map((d) => ({
        id: d.id,
        name: d.name,
        icon: d.icon,
        menus: d.menus as MenuKey[],
      })),
      groups: [...memGroups.values()].sort((a, b) => a.position - b.position).map(toGroup),
    };
  }
  const [divRes, grpRes] = await Promise.all([
    db().from("org_divisions").select("id,name,icon,menus"),
    db().from("org_division_groups").select("id,division,name,icon,menus,position").order("position"),
  ]);
  return {
    divisions: ((divRes.data ?? []) as DivRow[]).map((r) => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      menus: (r.menus ?? []) as MenuKey[],
    })),
    groups: ((grpRes.data ?? []) as GroupRow[]).map(toGroup),
  };
}

/** Susunan sub-grup satu divisi — daftar kosong mengembalikan susunan bawaan. */
export async function saveNavGroups(
  division: string,
  groups: { name: string; icon: string; menus: string[] }[],
): Promise<void> {
  const rows: GroupRow[] = groups
    .filter((g) => g.name.trim())
    .map((g, i) => ({
      id: navGroupId(division, g.name.trim()),
      division,
      name: g.name.trim(),
      icon: g.icon || "Briefcase",
      menus: g.menus,
      position: i,
    }));

  if (!dbEnabled) {
    for (const [id, row] of memGroups) if (row.division === division) memGroups.delete(id);
    for (const r of rows) memGroups.set(r.id, r);
    return;
  }
  // Ganti seluruh susunan divisi ini — urutan & keanggotaan menu ikut tersimpan.
  await db().from("org_division_groups").delete().eq("division", division);
  if (rows.length > 0) await db().from("org_division_groups").insert(rows);
}

export async function addNavDivision(input: { name: string; icon: string; menus: string[] }): Promise<{ id: string }> {
  const id = navDivisionId(input.name);
  const row = { id, name: input.name, icon: input.icon, menus: input.menus };
  if (!dbEnabled) {
    memDivs.set(id, row);
    return { id };
  }
  await db().from("org_divisions").upsert(row);
  return { id };
}

export async function deleteNavDivision(id: string): Promise<void> {
  if (!dbEnabled) {
    memDivs.delete(id);
    return;
  }
  await db().from("org_divisions").delete().eq("id", id);
}
