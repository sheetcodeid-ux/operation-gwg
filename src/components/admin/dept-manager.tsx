"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, Crown, Loader2, Plus, Search, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  addDepartmentAction,
  addEmployeeAction,
  deleteDepartmentAction,
  deleteEmployeeAction,
} from "@/lib/actions/org-structure";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { EmptyState } from "@/components/ui/page-header";
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
  const [query, setQuery] = React.useState("");
  // Single-open accordion: null = semua tertutup. Membuka satu menutup yang lain.
  const [openId, setOpenId] = React.useState<string | null>(null);
  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));

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

  const addDept = () => run(() => addDepartmentAction(deptName), "Departemen ditambahkan", () => setDeptName(""));

  const q = query.trim().toLowerCase();
  const filtered = React.useMemo(() => {
    if (!q) return departments;
    return departments
      .map((d) => {
        const nameHit = d.name.toLowerCase().includes(q);
        const emps = nameHit ? d.employees : d.employees.filter((e) => e.name.toLowerCase().includes(q) || e.jabatan.toLowerCase().includes(q));
        return nameHit || emps.length ? { ...d, employees: emps } : null;
      })
      .filter((d): d is DeptDisplay => d !== null);
  }, [departments, q]);

  return (
    <div className="space-y-4">
      {/* Add panels */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl border border-border p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-muted ring-1 ring-border">
              <Building2 className="size-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Tambah Departemen</p>
              <p className="text-[11px] text-muted-foreground">Grup baru untuk struktur assessment</p>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <Field label="Nama Departemen" className="flex-1">
              <Input
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                placeholder="mis. Marketing"
                onKeyDown={(e) => e.key === "Enter" && deptName.trim() && addDept()}
              />
            </Field>
            <Button disabled={pending || !deptName.trim()} onClick={addDept}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Tambah
            </Button>
          </div>
        </div>

        <div className="glass rounded-2xl border border-border p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-muted ring-1 ring-border">
              <UserPlus className="size-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Tambah Karyawan</p>
              <p className="text-[11px] text-muted-foreground">Masukkan orang ke sebuah departemen</p>
            </div>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label="Departemen">
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
          <label className="mt-2.5 flex items-center gap-2 text-xs text-foreground">
            <input type="checkbox" checked={empHead} onChange={(e) => setEmpHead(e.target.checked)} className="size-4 accent-primary" />
            <Crown className="size-3.5 text-amber-500" /> Kepala / atasan divisi (dinilai langsung oleh Director)
          </label>
          <Button
            className="mt-3 w-full"
            disabled={pending || !empDept || !empName.trim()}
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

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari departemen, jabatan, atau nama karyawan…" className="pl-9" />
      </div>

      {/* Department accordion */}
      {filtered.length === 0 ? (
        <EmptyState icon={Search} title="Tidak ada hasil" description={`Tak ada departemen atau karyawan yang cocok dengan “${query}”.`} />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((d) => {
            // Saat mencari, semua hasil dibuka agar kecocokan terlihat; selain
            // itu accordion tunggal (hanya satu terbuka).
            const open = !!q || openId === d.id;
            return (
              <div key={d.id} className="glass overflow-hidden rounded-2xl border border-border">
                <div className="flex items-center gap-1 p-1.5">
                  <button
                    type="button"
                    onClick={() => toggle(d.id)}
                    aria-expanded={open}
                    className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted ring-1 ring-border">
                        <Building2 className="size-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-semibold text-foreground">{d.name}</span>
                          <Badge tone={d.source === "extra" ? "cyan" : "neutral"}>{d.source === "extra" ? "tambahan" : "bawaan"}</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{d.employees.length} karyawan</p>
                      </div>
                    </div>
                    <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
                  </button>
                  {d.source === "extra" && (
                    <button
                      type="button"
                      disabled={pending}
                      className="mr-1 grid size-8 shrink-0 place-items-center rounded-lg text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
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

                {/* Collapsible body (smooth grid-rows transition, Aniq idiom) */}
                <div className={cn("grid transition-[grid-template-rows] duration-200 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                  <div className="overflow-hidden">
                    <div className="border-t border-border/60 p-3">
                      {d.employees.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">Belum ada karyawan di departemen ini</p>
                      ) : (
                        <div className="grid gap-1.5 sm:grid-cols-2">
                          {d.employees.map((e) => {
                            const isHead = e.jabatan.toLowerCase().startsWith("head") || e.jabatan.toLowerCase().includes("kepala");
                            return (
                              <div
                                key={e.id}
                                className={cn(
                                  "group flex items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-colors",
                                  e.source === "extra" ? "border-primary/25 bg-primary/[0.04]" : "border-border bg-muted/20",
                                )}
                              >
                                <Avatar name={e.name} size={30} />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="truncate text-sm font-medium text-foreground">{e.name}</span>
                                    {isHead && <Crown className="size-3 shrink-0 text-amber-500" />}
                                  </div>
                                  <p className="truncate text-[11px] text-muted-foreground">{e.jabatan}</p>
                                </div>
                                {e.source === "extra" && (
                                  <button
                                    type="button"
                                    disabled={pending}
                                    className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                                    title="Hapus karyawan"
                                    onClick={() => run(() => deleteEmployeeAction(e.id), "Karyawan dihapus")}
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
