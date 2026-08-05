"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Layers, Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveDivisionGroupsAction } from "@/lib/actions/org-structure";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Field, Input } from "@/components/ui/input";
import { NAV_ICONS } from "@/components/layout/icons";
import { cn } from "@/lib/utils";
import type { MenuOption } from "./division-manager";

export interface GroupDisplay {
  name: string;
  icon: string;
  menus: string[];
}
export interface DivisionGroups {
  division: string;
  /** Menu yang tersedia di divisi ini (batas pilihan saat menyusun bidang). */
  menus: MenuOption[];
  groups: GroupDisplay[];
  /** true bila susunan berasal dari bawaan aplikasi, bukan dari admin. */
  isDefault: boolean;
}

const ICON_CHOICES = [
  "Briefcase", "Store", "Wallet", "ChartColumnBig", "GraduationCap", "Headset", "UserRound", "FolderInput",
  "Target", "Calculator", "Megaphone", "ClipboardCheck", "ShieldCheck", "Users", "ListChecks", "FileText",
];

/**
 * Penyusun "bidang kerja" di dalam satu divisi — inilah yang membuat sidebar
 * bertingkat (mis. Human Capital → Talent Acquisition → Permintaan Karyawan).
 * Menu yang tidak dimasukkan ke bidang mana pun otomatis turun ke bawah,
 * berurutan abjad.
 */
export function GroupManager({ divisions }: { divisions: DivisionGroups[] }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [division, setDivision] = React.useState(divisions[0]?.division ?? "");

  const current = divisions.find((d) => d.division === division);
  const [draft, setDraft] = React.useState<GroupDisplay[]>(current?.groups ?? []);

  // Ganti divisi ⇒ muat susunan divisi itu.
  const [loadedFor, setLoadedFor] = React.useState(division);
  if (loadedFor !== division) {
    setLoadedFor(division);
    setDraft(divisions.find((d) => d.division === division)?.groups ?? []);
  }

  const assigned = new Set(draft.flatMap((g) => g.menus));
  const loose = (current?.menus ?? []).filter((m) => !assigned.has(m.key));

  const patch = (i: number, next: Partial<GroupDisplay>) =>
    setDraft((d) => d.map((g, j) => (j === i ? { ...g, ...next } : g)));

  const move = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.length) return d;
      const next = [...d];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const toggleMenu = (i: number, key: string) =>
    setDraft((d) =>
      d.map((g, j) => {
        if (j !== i) return { ...g, menus: g.menus.filter((k) => k !== key) }; // satu menu hanya di satu bidang
        return { ...g, menus: g.menus.includes(key) ? g.menus.filter((k) => k !== key) : [...g.menus, key] };
      }),
    );

  const save = () =>
    start(async () => {
      const res = await saveDivisionGroupsAction({ division, groups: draft });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(draft.length === 0 ? "Susunan dikembalikan ke bawaan" : "Susunan sidebar disimpan");
      router.refresh();
    });

  if (!current) {
    return <p className="text-sm text-muted-foreground">Belum ada divisi untuk disusun.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="glass flex flex-wrap items-end gap-3 rounded-2xl border border-border p-4">
        <Field label="Divisi" className="min-w-[14rem] flex-1">
          <Combobox
            value={division}
            onChange={setDivision}
            options={divisions.map((d) => ({ value: d.division, label: d.division }))}
            searchPlaceholder="Cari divisi…"
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setDraft((d) => [...d, { name: "", icon: "Briefcase", menus: [] }])}
            disabled={pending}
          >
            <Plus className="size-4" /> Tambah Bidang
          </Button>
          <Button variant="ghost" onClick={() => setDraft([])} disabled={pending || draft.length === 0}>
            <RotateCcw className="size-4" /> Kosongkan
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan
          </Button>
        </div>
      </div>

      {current.isDefault && draft.length > 0 && (
        <p className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Susunan ini masih bawaan aplikasi. Setelah disimpan, susunan Anda yang dipakai.
        </p>
      )}

      {draft.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center">
          <Layers className="mx-auto mb-2 size-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Tanpa bidang</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Semua menu divisi ini tampil rata di sidebar, urut abjad. Tambahkan bidang untuk mengelompokkannya.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {draft.map((g, i) => {
            const Icon = NAV_ICONS[g.icon] ?? NAV_ICONS.Briefcase;
            return (
              <div key={i} className="glass rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/25">
                    <Icon className="size-4" />
                  </div>
                  <Field label={`Nama Bidang ${i + 1}`} className="min-w-[12rem] flex-1">
                    <Input
                      value={g.name}
                      onChange={(e) => patch(i, { name: e.target.value })}
                      placeholder="mis. Talent Acquisition"
                    />
                  </Field>
                  <div className="flex gap-1">
                    <Button size="icon-sm" variant="outline" disabled={i === 0} onClick={() => move(i, -1)} title="Naikkan">
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button size="icon-sm" variant="outline" disabled={i === draft.length - 1} onClick={() => move(i, 1)} title="Turunkan">
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      className="text-red-600 dark:text-red-400"
                      onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}
                      title="Hapus bidang"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3">
                  <p className="mb-1.5 text-xs font-medium text-foreground">Ikon</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ICON_CHOICES.map((choice) => {
                      const ChoiceIcon = NAV_ICONS[choice];
                      const active = g.icon === choice;
                      return (
                        <button
                          key={choice}
                          type="button"
                          onClick={() => patch(i, { icon: choice })}
                          title={choice}
                          className={cn(
                            "grid size-8 place-items-center rounded-lg border transition-colors",
                            active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {ChoiceIcon && <ChoiceIcon className="size-4" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-xs font-medium text-foreground">Menu di bidang ini</p>
                    <span className="text-[11px] text-muted-foreground">{g.menus.length} dipilih</span>
                  </div>
                  <div className="grid gap-1 rounded-xl border border-border p-1.5 sm:grid-cols-2">
                    {current.menus.map((m) => {
                      const checked = g.menus.includes(m.key);
                      const takenElsewhere = !checked && assigned.has(m.key);
                      return (
                        <label
                          key={m.key}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
                            checked ? "bg-primary/[0.06]" : "hover:bg-muted/50",
                            takenElsewhere && "opacity-50",
                          )}
                        >
                          <span className={cn("grid size-4 shrink-0 place-items-center rounded border", checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")}>
                            {checked && <Check className="size-3" />}
                          </span>
                          <span className="flex-1 truncate text-foreground">{m.label}</span>
                          {takenElsewhere && <span className="shrink-0 text-[10px] text-muted-foreground">di bidang lain</span>}
                          <input type="checkbox" className="hidden" checked={checked} onChange={() => toggleMenu(i, m.key)} />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-muted/20 p-4">
        <p className="text-xs font-medium text-foreground">Menu umum (tampil paling bawah, urut abjad)</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {loose.length === 0 ? (
            <span className="text-xs text-muted-foreground">Semua menu sudah masuk bidang.</span>
          ) : (
            loose.map((m) => (
              <span key={m.key} className="rounded-lg border border-border bg-background/40 px-2 py-1 text-xs text-foreground">
                {m.label}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
