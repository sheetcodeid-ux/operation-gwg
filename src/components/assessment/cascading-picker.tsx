"use client";

import { Field, Select } from "@/components/ui/input";
import { departmentOptions, employeeOptions, positionOptions } from "@/lib/assessment/org";
import { cn } from "@/lib/utils";
import { useAssessment } from "./context";

/**
 * Cascading Departemen → Jabatan → Nama selector wired to the shared candidate
 * (spec §8). Reused by the identity form and by the Penilaian / Interview filter
 * bars — selecting a person there is the same as choosing who is assessed.
 */
export function CascadingPicker({ className }: { className?: string }) {
  const a = useAssessment();
  const positions = positionOptions(a.candidate.departmentId);
  const employees = employeeOptions(a.candidate.positionId);
  const hasDept = !!a.candidate.departmentId;
  const hasPosition = !!a.candidate.positionId;
  const emptyPosition = hasPosition && employees.length === 0;

  return (
    <div className={cn("grid gap-3 sm:grid-cols-3", className)}>
      <Field label="Departemen">
        <Select value={a.candidate.departmentId} onChange={(e) => a.setDepartment(e.target.value)}>
          <option value="">Pilih departemen…</option>
          {departmentOptions().map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Jabatan">
        <Select value={a.candidate.positionId} onChange={(e) => a.setPosition(e.target.value)} disabled={!hasDept}>
          <option value="">{hasDept ? "Pilih jabatan…" : "Pilih departemen dulu"}</option>
          {positions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Nama Lengkap">
        <Select
          value={a.candidate.employeeId}
          onChange={(e) => a.setEmployee(e.target.value)}
          disabled={!hasPosition || emptyPosition}
        >
          <option value="">
            {!hasPosition ? "Pilih jabatan dulu" : emptyPosition ? "Belum ada karyawan" : "Pilih nama…"}
          </option>
          {employees.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
