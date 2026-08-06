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

/**
 * Konfigurasi sidebar dibaca di layout, artinya SETIAP render halaman — padahal
 * isinya hanya berubah saat admin mengubah susunan menu. Tanpa cache, tiap klik
 * sidebar membayar dua round trip ke database sebelum halaman boleh tampil.
 * Di-cache di globalThis supaya bertahan antar request pada instance yang sama,
 * dan dibuang paksa oleh setiap penulisan di bawah.
 */
const g = globalThis as typeof globalThis & { __GWG_NAV_EXTRA__?: { at: number; value: NavExtra } };
const NAV_TTL_MS = 60_000;

/** Dipanggil setiap kali susunan menu berubah, supaya perubahannya langsung terlihat. */
export function invalidateNavExtra() {
  g.__GWG_NAV_EXTRA__ = undefined;
}

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
  const cached = g.__GWG_NAV_EXTRA__;
  if (cached && Date.now() - cached.at < NAV_TTL_MS) return cached.value;

  const [divRes, grpRes] = await Promise.all([
    db().from("org_divisions").select("id,name,icon,menus"),
    db().from("org_division_groups").select("id,division,name,icon,menus,position").order("position"),
  ]);
  // Gagal baca ⇒ pakai cache lama kalau ada; sidebar kosong lebih buruk daripada
  // sidebar yang telat satu menit.
  if (divRes.error || grpRes.error) {
    console.error("[nav] gagal memuat konfigurasi sidebar:", divRes.error?.message ?? grpRes.error?.message);
    if (cached) return cached.value;
  }
  const value: NavExtra = {
    divisions: ((divRes.data ?? []) as DivRow[]).map((r) => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      menus: (r.menus ?? []) as MenuKey[],
    })),
    groups: ((grpRes.data ?? []) as GroupRow[]).map(toGroup),
  };
  g.__GWG_NAV_EXTRA__ = { at: Date.now(), value };
  return value;
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

  invalidateNavExtra();
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
  invalidateNavExtra();
  if (!dbEnabled) {
    memDivs.set(id, row);
    return { id };
  }
  await db().from("org_divisions").upsert(row);
  return { id };
}

export async function deleteNavDivision(id: string): Promise<void> {
  invalidateNavExtra();
  if (!dbEnabled) {
    memDivs.delete(id);
    return;
  }
  await db().from("org_divisions").delete().eq("id", id);
}
