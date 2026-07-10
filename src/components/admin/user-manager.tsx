"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Clock,
  Eye,
  EyeOff,
  ImagePlus,
  KeyRound,
  Loader2,
  Lock,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABEL, type Tone } from "@/lib/constants";
import { ROLE_DIVISION, accessibleMenuKeys, builtInDivisions, navAll, setNavExtras, type Division, type NavExtra } from "@/lib/nav";
import type { Role } from "@/lib/types";
import {
  assignRoleAction,
  createUserAction,
  deleteUserAction,
  updateGrantsAction,
  updateUserAction,
} from "@/lib/actions/users";
import { useI18n } from "@/lib/i18n/provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { Field, Input, Label } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { StatTile } from "@/components/ui/stat";
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
  phone: string | null;
  country: string | null;
  avatarUrl: string | null;
  department: string | null;
  grants: string[];
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
  member: "neutral",
};
const ROLES = (Object.keys(ROLE_LABEL) as Role[]).filter((r) => r !== "member");
const DEFAULT_DIVISION: Division = "Operation";
// Every sidebar division (built-in role-divisions + department-aligned ones).
const ALL_DIVISIONS = builtInDivisions() as Division[];
// Roles a division exposes for manual pick (the generic `member` is auto-assigned).
const rolesInDivision = (d: Division) => ROLES.filter((r) => ROLE_DIVISION[r] === d);
const needsOutlets = (r: Role) => r === "area_coordinator" || r === "head_operation" || r === "pos_operation";
const isMulti = (r: Role) => r === "area_coordinator";
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};

/** A user's org division for display/filter: their assigned department, else the
 *  division implied by their access role. */
const userDivision = (u: UserRow) => u.department || ROLE_DIVISION[u.role];

export function UserManager({
  users,
  outlets,
  navExtra,
  departmentOptions = [],
}: {
  users: UserRow[];
  outlets: OutletLite[];
  navExtra?: NavExtra;
  departmentOptions?: string[];
}) {
  // Merge admin-defined sidebar divisions before the grants panel reads navAll().
  // Empty ⇒ identical to the built-in sidebar.
  setNavExtras(navExtra ?? { divisions: [] });
  const [creating, setCreating] = React.useState(false);
  const [editUser, setEditUser] = React.useState<UserRow | null>(null);
  const [rolesUser, setRolesUser] = React.useState<UserRow | null>(null);
  const [accessUser, setAccessUser] = React.useState<UserRow | null>(null);

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
          (!division || userDivision(u) === division) &&
          (!role || u.role === role),
      ),
    [users, q, email, division, role],
  );

  const [now] = React.useState(() => Date.now());
  const activeCount = users.filter((u) => u.active).length;
  const adminCount = users.filter((u) => u.role === "super_admin").length;
  const recentCount = users.filter((u) => now - new Date(u.createdAt).getTime() < 30 * 864e5).length;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">User Management</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Kelola akun pengguna dan hak aksesnya per divisi</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" /> Add User
        </Button>
      </div>

      {/* Stat cards — same model as the Operation dashboard KPI cards. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Users} label="Total Users" value={users.length} sub="Semua akun terdaftar" />
        <StatTile icon={ShieldCheck} label="Aktif" value={activeCount} sub="Bisa login" />
        <StatTile icon={Shield} label="Admin" value={adminCount} sub="Super Admin" />
        <StatTile icon={Clock} label="Baru (30 hari)" value={recentCount} sub="Ditambahkan bulan ini" />
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
              options={[
                { value: "", label: "Semua Divisi" },
                ...[...new Set([...ALL_DIVISIONS, ...departmentOptions])].map((d) => ({ value: d, label: d })),
              ]}
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
          <table className="w-full min-w-[52rem] text-sm">
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
                <tr key={u.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-foreground/[0.06]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} size={38} src={u.avatarUrl} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{u.name}</p>
                        <span className="mt-0.5 inline-block">
                          <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{userDivision(u)}</td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums text-muted-foreground">{fmtDate(u.createdAt)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge tone={u.active ? "success" : "danger"} dot>
                      {u.active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Eye className="size-4" /> View
                      </Link>
                      <RowMenu user={u} onEdit={() => setEditUser(u)} onRoles={() => setRolesUser(u)} onAccess={() => setAccessUser(u)} />
                    </div>
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

      {creating && <UserFormPanel mode="create" outlets={outlets} onClose={() => setCreating(false)} />}
      {editUser && <UserFormPanel mode="edit" user={editUser} outlets={outlets} onClose={() => setEditUser(null)} />}
      {rolesUser && <AssignRolesPanel user={rolesUser} onClose={() => setRolesUser(null)} />}
      {accessUser && <AccessPanel user={accessUser} onClose={() => setAccessUser(null)} />}
    </>
  );
}

function RowMenu({ user, onEdit, onRoles, onAccess }: { user: UserRow; onEdit: () => void; onRoles: () => void; onAccess: () => void }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Popover
      contentClassName="w-48"
      trigger={({ toggle }) => (
        <button onClick={toggle} className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <MoreVertical className="size-4" />
        </button>
      )}
    >
      {(close) => (
        <div className="text-sm">
          <button
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-foreground/90 hover:bg-muted"
            onClick={() => {
              close();
              onEdit();
            }}
          >
            <Pencil className="size-4 text-muted-foreground" /> Edit
          </button>
          <button
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-foreground/90 hover:bg-muted"
            onClick={() => {
              close();
              onRoles();
            }}
          >
            <Shield className="size-4 text-muted-foreground" /> Assign Roles
          </button>
          <button
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-foreground/90 hover:bg-muted"
            onClick={() => {
              close();
              onAccess();
            }}
          >
            <KeyRound className="size-4 text-muted-foreground" /> Hak Akses
          </button>
          <button
            disabled={pending}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-red-600 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
            onClick={() => {
              if (typeof window !== "undefined" && !window.confirm(`Hapus pengguna "${user.name}"? Tindakan ini tidak dapat dibatalkan.`)) return;
              start(async () => {
                const res = await deleteUserAction(user.id);
                if (res?.error) toast.error(res.error);
                else {
                  toast.success("Pengguna dihapus");
                  close();
                  router.refresh();
                }
              });
            }}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Delete
          </button>
        </div>
      )}
    </Popover>
  );
}

/** Shared create/edit slide-over. */
export function UserFormPanel({
  mode,
  user,
  outlets,
  onClose,
}: {
  mode: "create" | "edit";
  user?: UserRow;
  outlets: OutletLite[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const initFirst = user ? user.name.split(" ")[0] ?? "" : "";
  const initLast = user ? user.name.split(" ").slice(1).join(" ") : "";
  // A user's division = their department (if set) else the division of their role.
  const initDivision = (user ? user.department || ROLE_DIVISION[user.role] : DEFAULT_DIVISION) as Division;

  const [first, setFirst] = React.useState(initFirst);
  const [last, setLast] = React.useState(initLast);
  const [email, setEmail] = React.useState(user?.email ?? "");
  const [pwd, setPwd] = React.useState("");
  const [pwd2, setPwd2] = React.useState("");
  const [showPwd, setShowPwd] = React.useState(false);
  const [division, setDivision] = React.useState<Division>(initDivision);
  const [role, setRole] = React.useState<Role>(user?.role ?? rolesInDivision(initDivision)[0] ?? "member");
  const [department, setDepartment] = React.useState<string>(user?.department ?? "");
  const [selected, setSelected] = React.useState<string[]>(user?.outletIds ?? []);
  const [phone, setPhone] = React.useState(user?.phone ?? "");
  const [country, setCountry] = React.useState(user?.country ?? "");
  const [avatar, setAvatar] = React.useState<string | null>(user?.avatarUrl ?? null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const isEdit = mode === "edit";
  const name = `${first} ${last}`.trim();
  // Roles to choose from: the selected division's, falling back to the current
  // role's own division so an existing role always shows.
  const divisionRoles = rolesInDivision(division).length ? rolesInDivision(division) : rolesInDivision(ROLE_DIVISION[role]);
  // A generic member (department-aligned division like Finance/Creative) has no
  // role to pick — their access is simply that division.
  const isMember = role === "member";

  function pickDivision(d: Division) {
    setDivision(d);
    const roles = rolesInDivision(d);
    if (roles.length) {
      // Built-in role-division: pick a role; access follows the role.
      setRole(roles[0]);
      setDepartment("");
    } else {
      // Department division (Creative, Finance, …): generic member placed there.
      setRole("member");
      setDepartment(d);
    }
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
    if (!isEdit && pwd.length < 6) return toast.error("Password minimal 6 karakter.");
    if (pwd && pwd.length < 6) return toast.error("Password minimal 6 karakter.");
    if (pwd !== pwd2) return toast.error("Konfirmasi password tidak cocok.");
    start(async () => {
      const contact = { phone: phone.trim() || null, country: country.trim() || null, avatarUrl: avatar, department: department || null };
      const res = isEdit
        ? await updateUserAction({ id: user!.id, name, email, role, password: pwd || undefined, outletIds: selected, ...contact })
        : await createUserAction({ name, email, role, password: pwd, outletIds: selected, ...contact });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(isEdit ? "Pengguna diperbarui" : `Pengguna ${name} dibuat di divisi ${division}`);
      onClose();
      router.refresh();
    });
  }

  return (
    <SlideOver title={isEdit ? "Edit User" : "Create New User"} subtitle={isEdit ? "Perbarui data pengguna" : "Tambah pengguna baru untuk divisi tujuan"} onClose={onClose}>
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
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
          <Field label={isEdit ? "Password" : "Password *"}>
            <div className="relative">
              <Input
                type={showPwd ? "text" : "password"}
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                placeholder={isEdit ? "Kosongkan bila tak diubah" : "Min. 6 karakter"}
                className="pr-9"
              />
              <button type="button" onClick={() => setShowPwd((s) => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
          <Field label={isEdit ? "Konfirmasi Password" : "Konfirmasi Password *"}>
            <Input type={showPwd ? "text" : "password"} value={pwd2} onChange={(e) => setPwd2(e.target.value)} placeholder="Ulangi password" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nomor Telepon">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+62…" />
          </Field>
          <Field label="Negara">
            <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Indonesia" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Divisi *">
            <Combobox
              portal
              matchTriggerWidth
              searchable={false}
              value={division}
              onChange={(v) => pickDivision(v as Division)}
              options={[...new Set([...ALL_DIVISIONS, division])].map((d) => ({ value: d, label: d }))}
            />
          </Field>
          <Field label="Jabatan / Role *">
            {isMember ? (
              <div className="flex h-9 items-center gap-1.5 rounded-lg border border-input bg-muted/30 px-3 text-sm text-muted-foreground">
                Anggota Divisi
              </div>
            ) : (
              <Combobox
                portal
                matchTriggerWidth
                searchable={false}
                value={role}
                onChange={(v) => {
                  setRole(v as Role);
                  setSelected([]);
                }}
                options={divisionRoles.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
              />
            )}
          </Field>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {isMember
            ? `Pengguna menjadi anggota divisi ${division} — hanya mengakses menu divisi tersebut (mis. Work Tracker).`
            : "Divisi menentukan menu yang bisa diakses; pilih jabatan/role di dalamnya."}
        </p>

        {needsOutlets(role) && <OutletPicker outlets={outlets} multi={isMulti(role)} selected={selected} onChange={setSelected} />}
      </div>

      <SlideOverFooter onClose={onClose} pending={pending}>
        <Button onClick={submit} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} {isEdit ? "Update User" : "Create User"}
        </Button>
      </SlideOverFooter>
    </SlideOver>
  );
}

/** Aniq-style "Manage Roles" — pick a single role (radio chips). */
export function AssignRolesPanel({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [role, setRole] = React.useState<Role>(user.role);

  function submit() {
    start(async () => {
      const res = await assignRoleAction(user.id, role);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Role diperbarui");
      onClose();
      router.refresh();
    });
  }

  return (
    <SlideOver title="Manage Roles" subtitle="Tetapkan peran akses pengguna" onClose={onClose}>
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
          <Avatar name={user.name} size={40} />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <div>
          <Label>Peran Tersedia</Label>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ROLES.map((r) => {
              const active = role === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                    active ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  <span className={cn("grid size-4 shrink-0 place-items-center rounded-full border", active ? "border-primary" : "border-muted-foreground/40")}>
                    {active && <span className="size-2 rounded-full bg-primary" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{ROLE_LABEL[r]}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{ROLE_DIVISION[r]}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <SlideOverFooter onClose={onClose} pending={pending}>
        <Button onClick={submit} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Shield className="size-4" />} Update Roles
        </Button>
      </SlideOverFooter>
    </SlideOver>
  );
}

/** Grant a user extra menu access outside their own division (per-menu). */
export function AccessPanel({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, start] = React.useTransition();
  const home = ROLE_DIVISION[user.role];
  const roleAllowed = React.useMemo(() => new Set(accessibleMenuKeys(user.role)), [user.role]);
  const all = React.useMemo(() => navAll(), []);
  const sections = React.useMemo(() => [...new Set(all.map((i) => i.section))], [all]);
  const [grants, setGrants] = React.useState<Set<string>>(() => new Set(user.grants));

  const toggle = (key: string) =>
    setGrants((g) => {
      const n = new Set(g);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  function submit() {
    start(async () => {
      const res = await updateGrantsAction(user.id, [...grants]);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Hak akses diperbarui");
      onClose();
      router.refresh();
    });
  }

  return (
    <SlideOver title="Hak Akses" subtitle="Beri akses menu di luar divisi asal pengguna" onClose={onClose}>
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
          <Avatar name={user.name} size={40} src={user.avatarUrl} />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              Divisi asal: <span className="font-medium text-foreground">{home}</span>
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Centang menu divisi lain yang boleh dibuka pengguna ini. Menu divisi asalnya (dari role) sudah otomatis aktif.
        </p>

        <div className="space-y-4">
          {sections.map((section) => {
            const items = all.filter((i) => i.section === section);
            return (
              <div key={section}>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{section}</p>
                <div className="space-y-1 rounded-xl border border-border p-1.5">
                  {items.map((item) => {
                    const gid = `${section}:${item.key}`;
                    const fromRole = section === home && roleAllowed.has(item.key);
                    const checked = fromRole || grants.has(gid);
                    return (
                      <label
                        key={gid}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
                          fromRole ? "opacity-60" : "hover:bg-muted/50",
                        )}
                      >
                        <span
                          className={cn(
                            "grid size-4 shrink-0 place-items-center rounded border",
                            checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                          )}
                        >
                          {checked && <Check className="size-3" />}
                        </span>
                        <span className="flex-1 truncate text-foreground">{t(`nav.${item.label}`)}</span>
                        {fromRole && (
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Lock className="size-3" /> dari role
                          </span>
                        )}
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={checked}
                          disabled={fromRole}
                          onChange={() => !fromRole && toggle(gid)}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <SlideOverFooter onClose={onClose} pending={pending}>
        <Button onClick={submit} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Simpan Akses
        </Button>
      </SlideOverFooter>
    </SlideOver>
  );
}

function SlideOver({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-background/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-base font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SlideOverFooter({ onClose, pending, children }: { onClose: () => void; pending: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
      <Button variant="ghost" onClick={onClose} disabled={pending}>
        Cancel
      </Button>
      {children}
    </div>
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
    <Field label={multi ? `Outlet Ditugaskan (${selected.length})` : "Outlet Ditugaskan"}>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari outlet…" className="mb-2" />
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
        {filtered.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">Tidak ada outlet</p>}
      </div>
    </Field>
  );
}
