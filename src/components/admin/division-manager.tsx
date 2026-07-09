"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, LayoutGrid, Loader2, Lock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addDivisionAction, deleteDivisionAction } from "@/lib/actions/org-structure";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/page-header";
import { NAV_ICONS } from "@/components/layout/icons";
import { cn } from "@/lib/utils";

export interface MenuOption {
  key: string;
  label: string;
}
export interface DivisionDisplay {
  id: string;
  name: string;
  icon: string;
  menus: string[];
}

/** Icons offered for a custom division (must exist in NAV_ICONS). */
const ICON_CHOICES = ["Briefcase", "ShieldCheck", "FlaskConical", "Scale", "Settings2", "Network", "Store", "Users", "Award", "ChartSpline"];

export function DivisionManager({
  divisions,
  menuOptions,
}: {
  divisions: DivisionDisplay[];
  menuOptions: MenuOption[];
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [name, setName] = React.useState("");
  const [icon, setIcon] = React.useState("Briefcase");
  const [menus, setMenus] = React.useState<Set<string>>(new Set());

  const menuLabel = React.useMemo(() => new Map(menuOptions.map((m) => [m.key, m.label])), [menuOptions]);

  const toggleMenu = (key: string) =>
    setMenus((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const submit = () =>
    start(async () => {
      const res = await addDivisionAction({ name, icon, menus: [...menus] });
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Divisi ditambahkan");
        setName("");
        setIcon("Briefcase");
        setMenus(new Set());
        router.refresh();
      }
    });

  const remove = (d: DivisionDisplay) =>
    start(async () => {
      if (typeof window !== "undefined" && !window.confirm(`Hapus divisi "${d.name}"? Menu tetap ada, hanya grup ini yang hilang.`)) return;
      const res = await deleteDivisionAction(d.id);
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Divisi dihapus");
        router.refresh();
      }
    });

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* Create panel */}
      <div className="glass rounded-2xl border border-border p-5 lg:col-span-2">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-xl bg-muted ring-1 ring-border">
            <LayoutGrid className="size-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Tambah Divisi Aplikasi</p>
            <p className="text-[11px] text-muted-foreground">Grup menu baru di sidebar</p>
          </div>
        </div>

        <Field label="Nama Divisi">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Marketing" />
        </Field>

        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-foreground">Ikon</p>
          <div className="flex flex-wrap gap-1.5">
            {ICON_CHOICES.map((choice) => {
              const Icon = NAV_ICONS[choice];
              const active = icon === choice;
              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() => setIcon(choice)}
                  title={choice}
                  className={cn(
                    "grid size-9 place-items-center rounded-xl border transition-colors",
                    active ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30" : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {Icon && <Icon className="size-4" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-medium text-foreground">Menu di dalam divisi</p>
            <span className="text-[11px] text-muted-foreground">{menus.size} dipilih</span>
          </div>
          <div className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto rounded-xl border border-border p-1.5 sm:grid-cols-2">
            {menuOptions.map((m) => {
              const checked = menus.has(m.key);
              return (
                <label
                  key={m.key}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
                    checked ? "bg-primary/[0.06]" : "hover:bg-muted/50",
                  )}
                >
                  <span className={cn("grid size-4 shrink-0 place-items-center rounded border", checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")}>
                    {checked && <Check className="size-3" />}
                  </span>
                  <span className="flex-1 truncate text-foreground">{m.label}</span>
                  <input type="checkbox" className="hidden" checked={checked} onChange={() => toggleMenu(m.key)} />
                </label>
              );
            })}
          </div>
        </div>

        <Button className="mt-4 w-full" disabled={pending || !name.trim() || menus.size === 0} onClick={submit}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Tambah Divisi
        </Button>
      </div>

      {/* List */}
      <div className="lg:col-span-3">
        {divisions.length === 0 ? (
          <EmptyState
            icon={LayoutGrid}
            title="Belum ada divisi tambahan"
            description="Divisi bawaan (Operation, Supervisor, R&D, HRD, Administrator) tetap aktif. Buat divisi baru untuk mengelompokkan menu di sidebar."
          />
        ) : (
          <div className="space-y-3">
            {divisions.map((d) => {
              const Icon = NAV_ICONS[d.icon] ?? NAV_ICONS.Briefcase;
              return (
                <div key={d.id} className="glass rounded-2xl border border-border p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/25">
                        {Icon && <Icon className="size-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-semibold text-foreground">{d.name}</span>
                          <Badge tone="cyan">tambahan</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{d.menus.length} menu</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={pending}
                      className="grid size-8 shrink-0 place-items-center rounded-lg text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
                      title="Hapus divisi"
                      onClick={() => remove(d)}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {d.menus.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Tanpa menu</span>
                    ) : (
                      d.menus.map((k) => (
                        <span key={k} className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/30 px-2 py-1 text-xs text-foreground">
                          {menuLabel.get(k) ?? k}
                        </span>
                      ))
                    )}
                  </div>
                  <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Lock className="size-3" /> Terkunci untuk semua user sampai diberi <span className="font-medium text-foreground">Hak Akses</span> di User Management
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
