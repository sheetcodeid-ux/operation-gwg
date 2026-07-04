"use client";

import { ROLE_LABEL } from "@/lib/constants";
import type { Role } from "@/lib/types";
import { WORK_DIVISIONS } from "@/lib/nav";
import { Combobox } from "@/components/ui/combobox";
import type { DivisionMembers } from "./task-sheet";

export const DIVISIONS: Role[] = WORK_DIVISIONS;

export function divisionLabel(r: Role) {
  return ROLE_LABEL[r];
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
  const list = members[division as Role] ?? [];
  return [...list].sort((a, b) => a.name.localeCompare(b.name));
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "YYYY-MM" key for an ISO date (UTC), matching the calendar's UTC convention. */
export function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()).padStart(2, "0")}`;
}

function monthKeyLabel(key: string) {
  const [y, m] = key.split("-");
  return `${MONTH_NAMES[Number(m)]} ${y}`;
}

/** Distinct months (newest first) present in the given ISO dates → filter options. */
export function monthOptions(isoDates: string[]): { value: string; label: string }[] {
  const keys = [...new Set(isoDates.map(monthKey))].sort().reverse();
  return keys.map((k) => ({ value: k, label: monthKeyLabel(k) }));
}

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
      className={className ?? "min-w-0 shrink basis-40"}
      value={value}
      onChange={onChange}
      options={[{ value: "all", label: "All months" }, ...options]}
      searchPlaceholder="Month…"
    />
  );
}

/** Dropdown to filter tasks by division. value "all" = no filter. */
export function DivisionFilter({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <Combobox
      className={className ?? "min-w-0 shrink basis-44"}
      value={value}
      onChange={onChange}
      options={[{ value: "all", label: "All divisions" }, ...DIVISIONS.map((r) => ({ value: r, label: ROLE_LABEL[r] }))]}
      searchPlaceholder="Division…"
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
      className={className ?? "min-w-0 shrink basis-44"}
      value={value}
      onChange={onChange}
      options={[{ value: "all", label: "All PIC" }, ...people.map((p) => ({ value: p.id, label: p.name }))]}
      searchPlaceholder="PIC…"
    />
  );
}
