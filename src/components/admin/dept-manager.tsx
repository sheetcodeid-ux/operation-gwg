"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Crown, Loader2, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import {
  addDepartmentAction,
  addEmployeeAction,
  deleteDepartmentAction,
  deleteEmployeeAction,
} from "@/lib/actions/org-structure";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { StatTile } from "@/components/ui/stat";
import { cn } from "@/lib/utils";

export interface DeptEmp {
  id: string;
  name: string;
  jabatan: string;
  source: "base" | "extra";
}
export interface DeptDisplay {
  id: string;
  name: string;
  source: "base" | "extra";
  employees: DeptEmp[];
}

export function DeptManager({ departments }: { departments: DeptDisplay[] }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  const [deptName, setDeptName] = React.useState("");
  const [empDept, setEmpDept] = React.useState(departments[0]?.id ?? "");
  const [empName, setEmpName] = React.useState("");
  const [empJabatan, setEmpJabatan] = React.useState("");
  const [empHead, setEmpHead] = React.useState(false);

  const totalEmp = departments.reduce((s, d) => s + d.employees.length, 0);
  const extraDept = departments.filter((d) => d.source === "extra").length;
  const extraEmp = departments.reduce((s, d) => s + d.employees.filter((e) => e.source === "extra").length, 0);

  const run = (fn: () => Promise<{ error?: string; ok?: boolean }>, ok: string, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res?.error) toast.error(res.error);
      else {
        toast.success(ok);
        after?.();
        router.refresh();
      }
    });

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Building2} label="Departemen/Divisi" value={departments.length} sub={`${extraDept} tambahan`} />
        <StatTile icon={Users} label="Total Karyawan" value={totalEmp} sub={`${extraEmp} tambahan`} />
        <StatTile icon={Building2} label="Bawaan" value={departments.length - extraDept} sub="Tak bisa dihapus" />
        <StatTile icon={UserPlus} label="Tambahan" value={extraEmp + extraDept} sub="Bisa dikelola" />
      </div>

      {/* Add forms */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl border border-border p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Building2 className="size-4 text-muted-foreground" /> Tambah Departemen / Divisi
          </p>
          <div className="flex items-end gap-2">
            <Field label="Nama" className="flex-1">
              <Input value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="mis. Marketing" />
            </Field>
            <Button
              disabled={pending}
              onClick={() => run(() => addDepartmentAction(deptName), "Departemen ditambahkan", () => setDeptName(""))}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Tambah
            </Button>
          </div>
        </div>

        <div className="glass rounded-2xl border border-border p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <UserPlus className="size-4 text-muted-foreground" /> Tambah Karyawan
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Departemen/Divisi">
              <Combobox
                matchTriggerWidth
                value={empDept}
                onChange={setEmpDept}
                options={departments.map((d) => ({ value: d.id, label: d.name }))}
                placeholder="Pilih…"
                searchPlaceholder="Cari…"
              />
            </Field>
            <Field label="Jabatan">
              <Input value={empJabatan} onChange={(e) => setEmpJabatan(e.target.value)} placeholder="mis. Staff / Head Marketing" />
            </Field>
            <Field label="Nama Karyawan" className="sm:col-span-2">
              <Input value={empName} onChange={(e) => setEmpName(e.target.value)} placeholder="Nama lengkap" />
            </Field>
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-foreground">
            <input type="checkbox" checked={empHead} onChange={(e) => setEmpHead(e.target.checked)} className="size-4 accent-primary" />
            Ini kepala/atasan divisi (dinilai langsung oleh Director)
          </label>
          <Button
            className="mt-3 w-full"
            disabled={pending}
            onClick={() =>
              run(
                () => addEmployeeAction({ departmentId: empDept, jabatan: empJabatan, name: empName, isHead: empHead }),
                "Karyawan ditambahkan",
                () => {
                  setEmpName("");
                  setEmpJabatan("");
                  setEmpHead(false);
                },
              )
            }
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} Tambah Karyawan
          </Button>
        </div>
      </div>

      {/* Department list */}
      <div className="mt-4 space-y-3">
        {departments.map((d) => (
          <div key={d.id} className="glass rounded-2xl border border-border p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-muted-foreground" />
                <span className="font-semibold text-foreground">{d.name}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium",
                    d.source === "extra" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  {d.source === "extra" ? "tambahan" : "bawaan"}
                </span>
                <span className="text-xs text-muted-foreground">· {d.employees.length} karyawan</span>
              </div>
              {d.source === "extra" && (
                <button
                  type="button"
                  disabled={pending}
                  className="grid size-8 place-items-center rounded-lg text-red-600 hover:bg-red-500/10 dark:text-red-400"
                  title="Hapus departemen"
                  onClick={() => {
                    if (typeof window !== "undefined" && !window.confirm(`Hapus departemen "${d.name}" beserta karyawannya?`)) return;
                    run(() => deleteDepartmentAction(d.id), "Departemen dihapus");
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
            {d.employees.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {d.employees.map((e) => (
                  <span
                    key={e.id}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs",
                      e.source === "extra" ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30",
                    )}
                  >
                    {e.jabatan.toLowerCase().startsWith("head") && <Crown className="size-3 text-amber-500" />}
                    <span className="font-medium text-foreground">{e.name}</span>
                    <span className="text-muted-foreground">· {e.jabatan}</span>
                    {e.source === "extra" && (
                      <button
                        type="button"
                        disabled={pending}
                        className="ml-0.5 text-red-500 hover:text-red-600"
                        title="Hapus karyawan"
                        onClick={() => run(() => deleteEmployeeAction(e.id), "Karyawan dihapus")}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
