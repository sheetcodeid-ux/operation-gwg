"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Lock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addDivisionAction, deleteDivisionAction } from "@/lib/actions/org-structure";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
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
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Create */}
      <div className="glass rounded-2xl border border-border p-5">
        <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Plus className="size-4 text-muted-foreground" /> Tambah Divisi Aplikasi
        </p>
        <p className="mb-3 text-xs text-muted-foreground">
          Grup menu baru di sidebar. Setelah dibuat, beri akses ke pengguna lewat <span className="font-medium text-foreground">Hak Akses</span> di User Management.
        </p>

        <Field label="Nama Divisi">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Marketing" />
        </Field>

        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-foreground">Ikon</p>
          <div className="flex flex-wrap gap-1.5">
            {ICON_CHOICES.map((name) => {
              const Icon = NAV_ICONS[name];
              const active = icon === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setIcon(name)}
                  title={name}
                  className={cn(
                    "grid size-9 place-items-center rounded-lg border transition-colors",
                    active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {Icon && <Icon className="size-4" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-foreground">Menu di dalam divisi</p>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-border p-1.5">
            {menuOptions.map((m) => {
              const checked = menus.has(m.key);
              return (
                <label key={m.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50">
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

        <Button className="mt-3 w-full" disabled={pending} onClick={submit}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Tambah Divisi
        </Button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {divisions.length === 0 ? (
          <div className="glass grid min-h-[8rem] place-items-center rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            Belum ada divisi tambahan. Divisi bawaan (Operation, Supervisor, R&amp;D, HRD, Administrator) tetap aktif.
          </div>
        ) : (
          divisions.map((d) => {
            const Icon = NAV_ICONS[d.icon] ?? NAV_ICONS.Briefcase;
            return (
              <div key={d.id} className="glass rounded-2xl border border-border p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {Icon && <Icon className="size-4 text-muted-foreground" />}
                    <span className="font-semibold text-foreground">{d.name}</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">tambahan</span>
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    className="grid size-8 place-items-center rounded-lg text-red-600 hover:bg-red-500/10 dark:text-red-400"
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
                <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Lock className="size-3" /> Terkunci untuk semua user sampai diberi Hak Akses
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
