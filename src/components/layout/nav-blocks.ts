import type { NavItem } from "@/lib/nav";

/**
 * Satu baris di dalam sebuah divisi pada sidebar: bisa berupa sub-grup berisi
 * beberapa menu ("Talent Acquisition"), atau menu umum yang berdiri sendiri.
 *
 * `navFor`/`navAll` sudah mengurutkan menu satu grup berdampingan, jadi
 * pembagian di sini cukup memindai berurutan.
 */
export type NavBlock =
  | { kind: "group"; name: string; icon?: string; items: NavItem[] }
  | { kind: "item"; item: NavItem };

export function navBlocks(items: NavItem[]): NavBlock[] {
  const out: NavBlock[] = [];
  for (const item of items) {
    if (!item.group) {
      out.push({ kind: "item", item });
      continue;
    }
    const last = out[out.length - 1];
    if (last?.kind === "group" && last.name === item.group) last.items.push(item);
    else out.push({ kind: "group", name: item.group, icon: item.groupIcon, items: [item] });
  }
  return out;
}
