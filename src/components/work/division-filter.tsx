"use client";

import { ROLE_LABEL } from "@/lib/constants";
import type { Role } from "@/lib/types";
import { Combobox } from "@/components/ui/combobox";
import type { DivisionMembers } from "./task-sheet";

// Pembantu bulan kini tinggal di lib/month.ts supaya halaman SERVER juga bisa
// memakainya; di-ekspor ulang di sini agar impor lama tetap berjalan.
export { monthKey, monthOptions } from "@/lib/month";

/** Label a division value: a department name shows as-is; a legacy role value
 *  falls back to its human role label. */
export function divisionLabel(d: string) {
  return ROLE_LABEL[d as Role] ?? d;
}

/** Flatten division members → unique people, sorted by name (for the PIC filter). */
export function flattenMembers(members?: DivisionMembers): { id: string; name: string }[] {
  if (!members) return [];
  const map = new Map<string, string>();
  for (const list of Object.values(members)) for (const m of list) map.set(m.id, m.name);
  return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

/** PIC options for the chosen division: "all" → everyone; a division → only its members. */
export function membersForDivision(members: DivisionMembers | undefined, division: string): { id: string; name: string }[] {
  if (!members) return [];
  if (division === "all") return flattenMembers(members);
  const list = members[division] ?? [];
  return [...list].sort((a, b) => a.name.localeCompare(b.name));
}

// Sejalan dengan kalender & tanggal di seluruh web ini yang memakai id-ID.
/** Dropdown to filter tasks by month (of their start date). value "all" = no filter. */
export function MonthFilter({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <Combobox
      portal
      searchable={false}
      className={className ?? "w-40 shrink-0"}
      value={value}
      onChange={onChange}
      options={[{ value: "all", label: "Semua Bulan" }, ...options]}
    />
  );
}

/** Dropdown to filter tasks by division/department. value "all" = no filter. */
export function DivisionFilter({
  value,
  onChange,
  className,
  options = [],
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  options?: string[];
}) {
  return (
    <Combobox
      portal
      searchable={false}
      className={className ?? "w-44 shrink-0"}
      value={value}
      onChange={onChange}
      options={[{ value: "all", label: "Semua Departemen" }, ...options.map((d) => ({ value: d, label: divisionLabel(d) }))]}
    />
  );
}

/** Dropdown to filter tasks by category. value "all" = no filter. */
export function CategoryFilter({
  options,
  value,
  onChange,
  className,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <Combobox
      portal
      searchable={false}
      className={className ?? "w-40 shrink-0"}
      value={value}
      onChange={onChange}
      options={[{ value: "all", label: "Semua Kategori" }, ...options.map((c) => ({ value: c, label: c }))]}
    />
  );
}

/** Dropdown to filter tasks by PIC (person). value "all" = no filter. */
export function PicFilter({
  people,
  value,
  onChange,
  className,
}: {
  people: { id: string; name: string }[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <Combobox
      portal
      className={className ?? "w-44 shrink-0"}
      value={value}
      onChange={onChange}
      options={[{ value: "all", label: "Semua PIC" }, ...people.map((p) => ({ value: p.id, label: p.name }))]}
      searchPlaceholder="Cari nama…"
    />
  );
}
