"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Eye,
  EyeOff,
  ImagePlus,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Plus,
  Power,
  RotateCcw,
  Search,
  ShieldCheck,
  Store,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABEL, type Tone } from "@/lib/constants";
import { ROLE_DIVISION, type Division } from "@/lib/nav";
import type { Role } from "@/lib/types";
import {
  createUserAction,
  resetPasswordAction,
  toggleActiveAction,
  updateAssignmentAction,
} from "@/lib/actions/users";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Popover } from "@/components/ui/popover";
import { Field, Input, Label } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  areaId: string | null;
  outletIds: string[];
  active: boolean;
  scope: string;
  createdAt: string;
}
export interface OutletLite {
  id: string;
  name: string;
  code: string;
  areaId: string;
  areaName: string;
}

const ROLE_TONE: Record<Role, Tone> = {
  super_admin: "brand",
  head_operation: "cyan",
  area_coordinator: "success",
  data_operation: "amber",
  pos_operation: "neutral",
  admin_operation: "danger",
  supervisor: "warning",
  head_bar_rnd: "cyan",
  bar_rnd: "neutral",
  kitchen_rnd: "neutral",
  coordinator_rnd: "amber",
  legal: "brand",
  assessor: "cyan",
};
const ROLES = Object.keys(ROLE_LABEL) as Role[];
const DIVISIONS = [...new Set(ROLES.map((r) => ROLE_DIVISION[r]))];
const DEFAULT_DIVISION: Division = DIVISIONS.includes("Operation") ? "Operation" : DIVISIONS[0];
const rolesInDivision = (d: Division) => ROLES.filter((r) => ROLE_DIVISION[r] === d);
const needsOutlets = (r: Role) => r === "area_coordinator" || r === "head_operation" || r === "pos_operation";
const isMulti = (r: Role) => r === "area_coordinator";
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};

export function UserManager({ users, outlets }: { users: UserRow[]; outlets: OutletLite[] }) {
  const [creating, setCreating] = React.useState(false);
  const [resetUser, setResetUser] = React.useState<UserRow | null>(null);
  const [assignUser, setAssignUser] = React.useState<UserRow | null>(null);

  // ── filters ──
  const [q, setQ] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [division, setDivision] = React.useState<string>("");
  const [role, setRole] = React.useState<string>("");
  const resetFilters = () => {
    setQ("");
    setEmail("");
    setDivision("");
    setRole("");
  };

  const filtered = React.useMemo(
    () =>
      users.filter(
        (u) =>
          (!q || u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase())) &&
          (!email || u.email.toLowerCase().includes(email.toLowerCase())) &&
          (!division || ROLE_DIVISION[u.role] === division) &&
          (!role || u.role === role),
      ),
    [users, q, email, division, role],
  );

  // ── stats ──
  const now = Date.now();
  const activeCount = users.filter((u) => u.active).length;
  const adminCount = users.filter((u) => u.role === "super_admin").length;
  const recentCount = users.filter((u) => now - new Date(u.createdAt).getTime() < 30 * 864e5).length;

  return (
    <>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">User Management</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Kelola akun pengguna dan hak aksesnya per divisi</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" /> Add User
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} label="Total Users" value={users.length} tone="text-brand-500" />
        <StatCard icon={ShieldCheck} label="Aktif" value={activeCount} tone="text-emerald-500" />
        <StatCard icon={ShieldCheck} label="Admin" value={adminCount} tone="text-violet-500" />
        <StatCard icon={Clock} label="Baru (30 hari)" value={recentCount} tone="text-amber-500" />
      </div>

      {/* Filters */}
      <div className="glass mt-4 rounded-2xl border border-border p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Cari">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nama atau email…" className="pl-9" />
            </div>
          </Field>
          <Field label="Email">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Filter email…" />
          </Field>
          <Field label="Divisi">
            <Combobox
              matchTriggerWidth
              searchable={false}
              value={division}
              onChange={(v) => {
                setDivision(v);
                setRole("");
              }}
              options={[{ value: "", label: "Semua Divisi" }, ...DIVISIONS.map((d) => ({ value: d, label: d }))]}
              placeholder="Semua Divisi"
            />
          </Field>
          <Field label="Role">
            <Combobox
              matchTriggerWidth
              searchable={false}
              value={role}
              onChange={setRole}
              options={[
                { value: "", label: "Semua Role" },
                ...(division ? rolesInDivision(division as Division) : ROLES).map((r) => ({ value: r, label: ROLE_LABEL[r] })),
              ]}
              placeholder="Semua Role"
            />
          </Field>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Menampilkan <span className="font-medium text-foreground">{filtered.length}</span> dari {users.length} pengguna
          </p>
          <Button variant="outline" size="sm" onClick={resetFilters}>
            <RotateCcw className="size-3.5" /> Reset Filter
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="glass mt-4 overflow-hidden rounded-2xl border border-border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="whitespace-nowrap border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Divisi</th>
                <th className="px-4 py-3">Dibuat</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} size={36} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{u.name}</p>
                        <span className="mt-0.5 inline-block">
                          <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{ROLE_DIVISION[u.role]}</td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums text-muted-foreground">{fmtDate(u.createdAt)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge tone={u.active ? "success" : "danger"} dot>
                      {u.active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RowMenu user={u} onReset={() => setResetUser(u)} onAssign={() => setAssignUser(u)} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Tidak ada pengguna yang cocok dengan filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {creating && <CreateUserPanel outlets={outlets} onClose={() => setCreating(false)} />}
      {resetUser && <ResetDialog user={resetUser} onClose={() => setResetUser(null)} />}
      {assignUser && needsOutlets(assignUser.role) && (
        <AssignDialog user={assignUser} outlets={outlets} onClose={() => setAssignUser(null)} />
      )}
    </>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: number; tone: string }) {
  return (
    <div className="glass rounded-2xl border border-border p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className={cn("size-4", tone)} />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

/** Aniq-style right-hand slide-over to create a user, targeted at a division. */
function CreateUserPanel({ outlets, onClose }: { outlets: OutletLite[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [first, setFirst] = React.useState("");
  const [last, setLast] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [pwd, setPwd] = React.useState("");
  const [pwd2, setPwd2] = React.useState("");
  const [showPwd, setShowPwd] = React.useState(false);
  const [division, setDivision] = React.useState<Division>(DEFAULT_DIVISION);
  const [role, setRole] = React.useState<Role>(rolesInDivision(DEFAULT_DIVISION)[0]);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [avatar, setAvatar] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const name = `${first} ${last}`.trim();
  const divisionRoles = rolesInDivision(division);

  function pickDivision(d: Division) {
    setDivision(d);
    setRole(rolesInDivision(d)[0]);
    setSelected([]);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(f);
  }

  function submit() {
    if (!name) return toast.error("Nama depan wajib diisi.");
    if (!email) return toast.error("Email wajib diisi.");
    if (pwd.length < 6) return toast.error("Password minimal 6 karakter.");
    if (pwd !== pwd2) return toast.error("Konfirmasi password tidak cocok.");
    start(async () => {
      const res = await createUserAction({ name, email, role, password: pwd, outletIds: selected });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Pengguna ${name} dibuat di divisi ${division}`);
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-background/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-base font-semibold text-foreground">Create New User</p>
            <p className="text-xs text-muted-foreground">Tambah pengguna baru untuk divisi tujuan</p>
          </div>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* profile picture */}
          <div>
            <Label>Foto Profil</Label>
            <div className="mt-1.5 flex items-center gap-4">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="preview" className="size-16 rounded-full object-cover ring-1 ring-border" />
              ) : name ? (
                <Avatar name={name} size={64} />
              ) : (
                <div className="grid size-16 place-items-center rounded-full bg-muted text-muted-foreground ring-1 ring-border">
                  <ImagePlus className="size-6" />
                </div>
              )}
              <div>
                <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <ImagePlus className="size-4" /> Pilih Gambar
                </Button>
                <p className="mt-1 text-[11px] text-muted-foreground">Opsional · default dari inisial nama</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nama Depan *">
              <Input value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Nama depan" />
            </Field>
            <Field label="Nama Belakang">
              <Input value={last} onChange={(e) => setLast(e.target.value)} placeholder="Nama belakang" />
            </Field>
          </div>

          <Field label="Email *">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@gwg.co" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Password *">
              <div className="relative">
                <Input
                  type={showPwd ? "text" : "password"}
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  placeholder="Min. 6 karakter"
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
            <Field label="Konfirmasi Password *">
              <Input
                type={showPwd ? "text" : "password"}
                value={pwd2}
                onChange={(e) => setPwd2(e.target.value)}
                placeholder="Ulangi password"
              />
            </Field>
          </div>

          {/* Division + Role — the target division for this user */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Divisi *">
              <Combobox
                matchTriggerWidth
                searchable={false}
                value={division}
                onChange={(v) => pickDivision(v as Division)}
                options={DIVISIONS.map((d) => ({ value: d, label: d }))}
              />
            </Field>
            <Field label="Jabatan / Role *">
              <Combobox
                matchTriggerWidth
                searchable={false}
                value={role}
                onChange={(v) => {
                  setRole(v as Role);
                  setSelected([]);
                }}
                options={divisionRoles.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
              />
            </Field>
          </div>

          {needsOutlets(role) && (
            <OutletPicker outlets={outlets} multi={isMulti(role)} selected={selected} onChange={setSelected} />
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} Create User
          </Button>
        </div>
      </div>
    </div>
  );
}

function RowMenu({ user, onReset, onAssign }: { user: UserRow; onReset: () => void; onAssign: () => void }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Popover
      contentClassName="w-48"
      trigger={({ toggle }) => (
        <button onClick={toggle} className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
          <MoreHorizontal className="size-4" />
        </button>
      )}
    >
      {(close) => (
        <div className="text-sm">
          <button
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-foreground/90 hover:bg-muted"
            onClick={() => {
              close();
              onReset();
            }}
          >
            <KeyRound className="size-4 text-muted-foreground" /> Reset password
          </button>
          {needsOutlets(user.role) && (
            <button
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-foreground/90 hover:bg-muted"
              onClick={() => {
                close();
                onAssign();
              }}
            >
              <Store className="size-4 text-muted-foreground" /> Edit outlets
            </button>
          )}
          <button
            disabled={pending}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-foreground/90 hover:bg-muted disabled:opacity-50"
            onClick={() =>
              start(async () => {
                const res = await toggleActiveAction(user.id, !user.active);
                if (res?.error) toast.error(res.error);
                else {
                  toast.success(user.active ? "User deactivated" : "User activated");
                  close();
                  router.refresh();
                }
              })
            }
          >
            <Power className="size-4 text-muted-foreground" /> {user.active ? "Deactivate" : "Activate"}
          </button>
        </div>
      )}
    </Popover>
  );
}

function ResetDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [pending, start] = React.useTransition();
  const [pwd, setPwd] = React.useState("");
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="Reset Password" description={`Set a new password for ${user.name}.`} className="max-w-sm">
        <div className="space-y-4 p-5">
          <Field label="New Password">
            <Input type="text" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="min. 6 chars" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await resetPasswordAction(user.id, pwd);
                  if (res?.error) toast.error(res.error);
                  else {
                    toast.success("Password reset");
                    onClose();
                  }
                })
              }
            >
              {pending && <Loader2 className="size-4 animate-spin" />} Reset
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({ user, outlets, onClose }: { user: UserRow; outlets: OutletLite[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [selected, setSelected] = React.useState<string[]>(user.outletIds);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="Edit Outlet Assignment" description={`${user.name} · ${ROLE_LABEL[user.role]}`} className="max-w-lg">
        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
          <OutletPicker outlets={outlets} multi={isMulti(user.role)} selected={selected} onChange={setSelected} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await updateAssignmentAction(user.id, user.role, selected);
                  if (res?.error) toast.error(res.error);
                  else {
                    toast.success("Assignment updated");
                    onClose();
                    router.refresh();
                  }
                })
              }
            >
              {pending && <Loader2 className="size-4 animate-spin" />} Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OutletPicker({
  outlets,
  multi,
  selected,
  onChange,
}: {
  outlets: OutletLite[];
  multi: boolean;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [q, setQ] = React.useState("");
  const filtered = outlets.filter(
    (o) => o.name.toLowerCase().includes(q.toLowerCase()) || o.code.toLowerCase().includes(q.toLowerCase()),
  );

  function toggle(id: string) {
    if (multi) onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
    else onChange([id]);
  }

  return (
    <Field label={multi ? `Assigned Outlets (${selected.length})` : "Assigned Outlet"}>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search outlets…" className="mb-2" />
      <div className="max-h-52 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1">
        {filtered.map((o) => {
          const active = selected.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => toggle(o.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                active ? "bg-primary/15 text-foreground ring-1 ring-inset ring-primary/30" : "hover:bg-muted",
              )}
            >
              <span className="truncate">
                {o.name} <span className="text-muted-foreground">· {o.code}</span>
              </span>
              <span className="text-[11px] text-muted-foreground">{o.areaName}</span>
            </button>
          );
        })}
        {filtered.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">No outlets</p>}
      </div>
    </Field>
  );
}
