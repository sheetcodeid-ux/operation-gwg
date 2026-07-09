"use client";

import { departmentOptions, employeeOptions, positionOptions } from "@/lib/assessment/org";
import { useAssessment } from "./context";
import { Dropdown, ScrollRow } from "./parts";

/**
 * Cascading Departemen → Jabatan → Nama selector wired to the shared candidate
 * (spec §8). Reused by the identity form and by the Penilaian / Interview filter
 * bars. On mobile it becomes a swipeable row so the dropdowns never overlap.
 */
export function CascadingPicker() {
  const a = useAssessment();
  const positions = positionOptions(a.candidate.departmentId);
  const employees = employeeOptions(a.candidate.positionId);
  const hasDept = !!a.candidate.departmentId;
  const hasPosition = !!a.candidate.positionId;
  const emptyPosition = hasPosition && employees.length === 0;

  return (
    <ScrollRow cols={3}>
      <Dropdown
        label="Departemen"
        value={a.candidate.departmentId}
        onChange={a.setDepartment}
        options={departmentOptions()}
        placeholder="Pilih departemen…"
      />
      <Dropdown
        label="Jabatan"
        value={a.candidate.positionId}
        onChange={a.setPosition}
        options={positions}
        placeholder={hasDept ? "Pilih jabatan…" : "Pilih departemen dulu"}
        disabled={!hasDept}
      />
      <Dropdown
        label="Nama Lengkap"
        searchable
        value={a.candidate.employeeId}
        onChange={a.setEmployee}
        options={employees}
        placeholder={!hasPosition ? "Pilih jabatan dulu" : emptyPosition ? "Belum ada karyawan" : "Pilih nama…"}
        disabled={!hasPosition || emptyPosition}
      />
    </ScrollRow>
  );
}
