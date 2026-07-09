import "server-only";

import { db, dbEnabled } from "./db";
import { navDivisionId, type NavExtra, type MenuKey } from "@/lib/nav";

/** Admin-managed extra sidebar divisions (grup menu di sidebar), stored in the
 *  DB and merged on top of the built-in navigation. In demo mode (no DB) they
 *  live in memory. Never alters built-in divisions — purely additive. */

interface DivRow {
  id: string;
  name: string;
  icon: string;
  menus: string[];
}

const memDivs = new Map<string, DivRow>();

export async function getNavExtra(): Promise<NavExtra> {
  if (!dbEnabled) {
    return {
      divisions: [...memDivs.values()].map((d) => ({
        id: d.id,
        name: d.name,
        icon: d.icon,
        menus: d.menus as MenuKey[],
      })),
    };
  }
  const { data } = await db().from("org_divisions").select("id,name,icon,menus");
  return {
    divisions: ((data ?? []) as DivRow[]).map((r) => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      menus: (r.menus ?? []) as MenuKey[],
    })),
  };
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
