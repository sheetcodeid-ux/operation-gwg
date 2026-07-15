"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
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
  Save,
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
import { ROLE_DIVISION, accessibleMenuKeys, assignableDivisions, builtInDivisions, grantsForDivision, navAll, setNavExtras, type Division, type NavExtra } from "@/lib/nav";
import { builtInStructure } from "@/lib/assessment/org";
import type { Role } from "@/lib/types";
import {
  assignRoleAction,
  createUserAction,
  deleteUserAction,
  updateGrantsAction,
  updateUserAction,
} from "@/lib/actions/users";
import { deleteDepartmentAction, saveDepartmentAction } from "@/lib/actions/org-departments";
import { listAssignableOutlets, type AssignableOutlet } from "@/lib/actions/outlets";
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
  jabatan: string | null;
  grants: string[];
}
export interface OutletLite {
  id: string;
  name: string;
  code: string;
  areaId: string;
  areaName: string;
}
/** Admin-managed department → jabatan taxonomy (from the DB). */
export interface OrgDept {
  id: string;
  name: string;
  jabatan: string[];
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
// Every sidebar division (built-in role-divisions + department-aligned ones).
const ALL_DIVISIONS = builtInDivisions() as Division[];
/** Built-in GWG Head-Office structure: department → its jabatan (job titles /
 *  sub-teams), from the org chart (single source: lib/assessment/org.ts).
 *  Supervisor is NOT here — it stands by at the branches, not HO. Admins can
 *  extend this via "Kelola Departemen"; those additions merge on top. */
const HO_STRUCTURE: Record<string, string[]> = builtInStructure();
const HO_DEPARTMENTS = Object.keys(HO_STRUCTURE);
/** Stable empty array — avoids re-creating a new [] each render (memo-friendly). */
const NO_OUTLETS: string[] = [];
// Roles a division exposes for manual pick (the generic `member` is auto-assigned).
const rolesInDivision = (d: Division) => ROLES.filter((r) => ROLE_DIVISION[r] === d);
/** Merge + de-dupe department suggestions for the pickers. */
const deptSuggestions = (extra: string[], current?: string) =>
  [...new Set([...HO_DEPARTMENTS, ...ALL_DIVISIONS, ...extra, ...(current ? [current] : [])].filter(Boolean))];
/** Jabatan list for a department: built-in HO structure ∪ admin-managed taxonomy.
 *  Falls back to every known jabatan when the department has none defined yet. */
function jabatanFor(department: string, orgDepts: OrgDept[], current?: string): string[] {
  const managed = orgDepts.find((d) => d.name === department)?.jabatan ?? [];
  const specific = [...(HO_STRUCTURE[department] ?? []), ...managed];
  const all = specific.length ? specific : allJabatan(orgDepts);
  const uniq = [...new Set([...all, ...(current ? [current] : [])].filter(Boolean))];
  return uniq;
}
/** Every jabatan known across built-in + managed departments (flat fallback). */
const allJabatan = (orgDepts: OrgDept[]) => [
  ...new Set([...Object.values(HO_STRUCTURE).flat(), ...orgDepts.flatMap((d) => d.jabatan)]),
];
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
  orgDepts = [],
  initialPrefill,
}: {
  users: UserRow[];
  outlets: OutletLite[];
  navExtra?: NavExtra;
  departmentOptions?: string[];
  /** Admin-managed department → jabatan taxonomy (feeds the Add User comboboxes). */
  orgDepts?: OrgDept[];
  /** From "Buatkan Akun" on the Departemen page — opens the create form filled. */
  initialPrefill?: UserPrefill;
}) {
  // Merge admin-defined sidebar divisions before the grants panel reads navAll().
  // Empty ⇒ identical to the built-in sidebar.
  setNavExtras(navExtra ?? { divisions: [] });
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const [managingDepts, setManagingDepts] = React.useState(false);
  const [prefill, setPrefill] = React.useState<UserPrefill | undefined>(undefined);
  const [editUser, setEditUser] = React.useState<UserRow | null>(null);
  const [rolesUser, setRolesUser] = React.useState<UserRow | null>(null);
  const [accessUser, setAccessUser] = React.useState<UserRow | null>(null);

  // "Buatkan Akun" from the Departemen page: open the create form pre-filled,
  // then strip the query so a refresh doesn't reopen it.
  React.useEffect(() => {
    if (!initialPrefill || (!initialPrefill.name && !initialPrefill.division)) return;
    setPrefill(initialPrefill);
    setCreating(true);
    router.replace("/admin/users");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setManagingDepts(true)}>
            <Building2 className="size-4" /> Kelola Departemen
          </Button>
          <Button onClick={() => { setPrefill(undefined); setCreating(true); }}>
            <Plus className="size-4" /> Add User
          </Button>
        </div>
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
          <Field label="Departement">
            <Combobox
              matchTriggerWidth
              value={division}
              onChange={(v) => {
                setDivision(v);
                setRole("");
              }}
              options={[
                { value: "", label: "Semua Departement" },
                ...deptSuggestions(departmentOptions).map((d) => ({ value: d, label: d })),
              ]}
              placeholder="Semua Departement"
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
                <th className="px-4 py-3">Departement</th>
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
                  <td className="px-4 py-3">
                    <p className="text-foreground">{userDivision(u)}</p>
                    {u.jabatan && <p className="text-[11px] text-muted-foreground">{u.jabatan}</p>}
                  </td>
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

      {creating && <UserFormPanel mode="create" outlets={outlets} prefill={prefill} departmentOptions={departmentOptions} orgDepts={orgDepts} onClose={() => { setCreating(false); setPrefill(undefined); }} />}
      {editUser && <UserFormPanel mode="edit" user={editUser} outlets={outlets} departmentOptions={departmentOptions} orgDepts={orgDepts} onClose={() => setEditUser(null)} />}
      {rolesUser && <AssignRolesPanel user={rolesUser} onClose={() => setRolesUser(null)} />}
      {accessUser && <AccessPanel user={accessUser} onClose={() => setAccessUser(null)} />}
      {managingDepts && <DeptManagerPanel orgDepts={orgDepts} onClose={() => setManagingDepts(false)} />}
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

/** Prefill for a fresh Create form (e.g. "Buatkan Akun" from an org employee). */
export interface UserPrefill {
  name?: string;
  division?: string;
}

/** Shared create/edit slide-over. */
export function UserFormPanel({
  mode,
  user,
  outlets,
  prefill,
  departmentOptions = [],
  orgDepts = [],
  onClose,
}: {
  mode: "create" | "edit";
  user?: UserRow;
  outlets: OutletLite[];
  prefill?: UserPrefill;
  departmentOptions?: string[];
  orgDepts?: OrgDept[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const prefillName = prefill?.name ?? "";
  const initFirst = user ? user.name.split(" ")[0] ?? "" : prefillName.split(" ")[0] ?? "";
  const initLast = user ? user.name.split(" ").slice(1).join(" ") : prefillName.split(" ").slice(1).join(" ");

  const [first, setFirst] = React.useState(initFirst);
  const [last, setLast] = React.useState(initLast);
  const [email, setEmail] = React.useState(user?.email ?? "");
  // New accounts default to the shared password so they can be used immediately;
  // admin can still change it before creating.
  const [pwd, setPwd] = React.useState(mode === "create" ? "gwg12345" : "");
  const [pwd2, setPwd2] = React.useState(mode === "create" ? "gwg12345" : "");
  const [showPwd, setShowPwd] = React.useState(false);
  // Department (org placement) + jabatan (job title) are org data. Access is a
  // separate sidebar-division choice — picking one grants that sidebar's menus.
  const [department, setDepartment] = React.useState<string>(user?.department ?? prefill?.division ?? "");
  const [jabatan, setJabatan] = React.useState<string>(user?.jabatan ?? "");
  // Existing access div = the division of the user's first grant (grants are
  // stored as "<Division>:<menu>"). Super Admin keeps full access regardless.
  const [access, setAccess] = React.useState<string>(user?.grants?.[0]?.split(":")[0] ?? "");
  // Coordinator outlet selection lives in a ref (updated by the isolated picker)
  // so toggling an outlet never re-renders this heavy form. Read at submit.
  const outletsRef = React.useRef<string[]>(user?.outletIds ?? NO_OUTLETS);
  const handleOutlets = React.useCallback((ids: string[]) => {
    outletsRef.current = ids;
  }, []);
  const [phone, setPhone] = React.useState(user?.phone ?? "");
  const [country, setCountry] = React.useState(user?.country ?? "");
  const [avatar, setAvatar] = React.useState<string | null>(user?.avatarUrl ?? null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const isEdit = mode === "edit";
  const name = `${first} ${last}`.trim();
  const deptOptions = React.useMemo(
    () => deptSuggestions(departmentOptions, department).map((d) => ({ value: d, label: d })),
    [departmentOptions, department],
  );
  // Jabatan choices follow the selected department (built-in HO + managed taxonomy).
  const jabatanOptions = React.useMemo(
    () => [{ value: "", label: "— Tanpa jabatan —" }, ...jabatanFor(department, orgDepts, jabatan).map((j) => ({ value: j, label: j }))],
    [department, orgDepts, jabatan],
  );
  // Role (Akses) = which sidebar the user can open. Options are the sidebar
  // divisions; picking one grants that sidebar's menus. Assessment is separate
  // (every HO account gets it) so this choice never locks the assessment.
  const accessOptions = React.useMemo(
    () => [{ value: "", label: "— Tanpa akses sidebar —" }, ...assignableDivisions().map((d) => ({ value: d.name, label: d.name }))],
    [],
  );

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(f);
  }

  // A Coordinator Area account (jabatan "Coordinator Area East/West") is scoped
  // to outlets → area_coordinator role, multi-outlet picker.
  const isCoordinator = /coordinator\s*area/i.test(jabatan);
  // A Supervisor (Role Akses = Supervisor, or jabatan mentions supervisor) holds
  // exactly ONE outlet → supervisor role, single-outlet picker. Field staff, so
  // no assessment access.
  const isSupervisor = !isCoordinator && (access === "Supervisor" || /supervisor/i.test(jabatan));
  // Super Admin keeps its role on edit; coordinator/supervisor get their scoped
  // roles; everyone else is a generic member (access via the sidebar division).
  const finalRole: Role =
    isEdit && user?.role === "super_admin"
      ? "super_admin"
      : isCoordinator
        ? "area_coordinator"
        : isSupervisor
          ? "supervisor"
          : "member";
  const needsOutletPicker = isCoordinator || isSupervisor;
  // Local outlets as an instant fallback shown while the picker loads from POS.
  const fallbackOutlets = React.useMemo(() => outlets.map((o) => ({ id: o.id, name: o.name })), [outlets]);

  function submit() {
    if (!name) return toast.error("Nama depan wajib diisi.");
    if (!email) return toast.error("Email wajib diisi.");
    if (!department.trim()) return toast.error("Pilih atau ketik departemen.");
    if (!isEdit && pwd.length < 6) return toast.error("Password minimal 6 karakter.");
    if (pwd && pwd.length < 6) return toast.error("Password minimal 6 karakter.");
    if (pwd !== pwd2) return toast.error("Konfirmasi password tidak cocok.");
    start(async () => {
      const grants = finalRole === "super_admin" ? undefined : grantsForDivision(access);
      const contact = { phone: phone.trim() || null, country: country.trim() || null, avatarUrl: avatar, department: department.trim() || null, jabatan: jabatan.trim() || null, grants };
      const res = isEdit
        ? await updateUserAction({ id: user!.id, name, email, role: finalRole, password: pwd || undefined, outletIds: needsOutletPicker ? outletsRef.current : [], ...contact })
        : await createUserAction({ name, email, role: finalRole, password: pwd, outletIds: needsOutletPicker ? outletsRef.current : [], ...contact });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(isEdit ? "Pengguna diperbarui" : `Pengguna ${name} dibuat di departemen ${department.trim()}`);
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
          <Field label="Departement *">
            <Combobox
              portal
              matchTriggerWidth
              value={department}
              onChange={(v) => {
                setDepartment(v);
                setJabatan(""); // jabatan list depends on the department
              }}
              options={deptOptions}
              placeholder="Pilih departemen…"
              searchPlaceholder="Cari departemen…"
            />
          </Field>
          <Field label="Jabatan">
            <Combobox
              portal
              matchTriggerWidth
              value={jabatan}
              onChange={setJabatan}
              options={jabatanOptions}
              placeholder="Pilih jabatan…"
              searchPlaceholder="Cari jabatan…"
            />
          </Field>
        </div>
        <Field label="Role (Akses) — Sidebar">
          <Combobox
            portal
            matchTriggerWidth
            value={access}
            onChange={setAccess}
            options={accessOptions}
            placeholder="Pilih sidebar…"
            searchPlaceholder="Cari sidebar…"
          />
        </Field>
        <p className="text-[11px] text-muted-foreground">
          <b>Departement</b> &amp; <b>Jabatan</b> = penempatan organisasi (untuk assessment &amp; daftar nama). <b>Role (Akses)</b> = sidebar yang bisa dibuka — mis. pilih <i>Finance</i> agar bisa akses menu Finance. Tidak memengaruhi akses <b>Assessment</b> (semua akun HO tetap bisa).
        </p>

        {needsOutletPicker && (
          <OutletAssignPicker
            role={isSupervisor ? "supervisor" : "area_coordinator"}
            single={isSupervisor}
            userId={user?.id}
            fallback={fallbackOutlets}
            defaultSelected={user?.outletIds ?? NO_OUTLETS}
            onSelectedChange={handleOutlets}
          />
        )}
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

/** "Kelola Departemen & Jabatan" — define a department and the jabatan under it.
 *  Saved entries feed the Add User Departement/Jabatan comboboxes automatically. */
function DeptManagerPanel({ orgDepts, onClose }: { orgDepts: OrgDept[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [name, setName] = React.useState("");
  const [jabatan, setJabatan] = React.useState<string[]>([""]);

  const trimmed = name.trim();
  const isExisting = orgDepts.some((d) => d.name.trim().toLowerCase() === trimmed.toLowerCase());

  const reset = () => {
    setName("");
    setJabatan([""]);
  };
  const loadDept = (d: OrgDept) => {
    setName(d.name);
    setJabatan(d.jabatan.length ? [...d.jabatan] : [""]);
  };
  const loadHO = (dep: string) => {
    setName(dep);
    setJabatan([...(HO_STRUCTURE[dep] ?? [""])]);
  };
  const setJab = (i: number, v: string) => setJabatan((a) => a.map((x, idx) => (idx === i ? v : x)));
  const addJab = () => setJabatan((a) => [...a, ""]);
  const removeJab = (i: number) => setJabatan((a) => (a.length > 1 ? a.filter((_, idx) => idx !== i) : [""]));

  function save() {
    if (!trimmed) {
      toast.error("Nama departemen wajib diisi.");
      return;
    }
    start(async () => {
      const res = await saveDepartmentAction({ name: trimmed, jabatan });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Departemen "${trimmed}" disimpan`);
      reset();
      router.refresh();
    });
  }

  function del(d: OrgDept) {
    if (typeof window !== "undefined" && !window.confirm(`Hapus departemen "${d.name}" dari daftar?`)) return;
    start(async () => {
      const res = await deleteDepartmentAction(d.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Departemen dihapus");
      router.refresh();
    });
  }

  return (
    <SlideOver title="Kelola Departemen & Jabatan" subtitle="Tambah departemen lalu isi jabatannya — otomatis masuk ke Add User" onClose={onClose}>
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {/* Builder */}
        <div className="space-y-3 rounded-xl border border-border p-4">
          <Field label="Nama Departemen *">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Finance Accounting Tax" />
          </Field>
          {isExisting && trimmed && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Departemen ini sudah ada — menyimpan akan memperbarui daftar jabatannya.
            </p>
          )}

          <div>
            <Label>Jabatan</Label>
            <div className="mt-1.5 space-y-2">
              {jabatan.map((j, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={j} onChange={(e) => setJab(i, e.target.value)} placeholder={`Jabatan ${i + 1}, mis. Treasury`} />
                  <button
                    type="button"
                    onClick={() => removeJab(i)}
                    className="grid size-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Hapus jabatan"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addJab}>
              <Plus className="size-4" /> Tambah Jabatan
            </Button>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button onClick={save} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan Departemen
            </Button>
            {(trimmed || jabatan.some(Boolean)) && (
              <Button variant="ghost" size="sm" onClick={reset} disabled={pending}>
                Bersihkan
              </Button>
            )}
          </div>
        </div>

        {/* Quick prefill from the built-in Head-Office structure */}
        <div>
          <Label>Struktur Head Office (klik untuk isi cepat)</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {HO_DEPARTMENTS.map((dep) => (
              <button
                key={dep}
                type="button"
                onClick={() => loadHO(dep)}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {dep}
              </button>
            ))}
          </div>
        </div>

        {/* Saved (admin-managed) departments */}
        <div>
          <Label>Departemen Tersimpan ({orgDepts.length})</Label>
          {orgDepts.length === 0 ? (
            <p className="mt-2 rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
              Belum ada departemen tambahan. Buat di atas — hasilnya langsung tampil di dropdown Add User.
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              {orgDepts.map((d) => (
                <div key={d.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-foreground">{d.name}</p>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => loadDept(d)}
                        className="rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        Muat
                      </button>
                      <button
                        type="button"
                        onClick={() => del(d)}
                        disabled={pending}
                        className="grid size-7 place-items-center rounded-lg text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
                        aria-label="Hapus departemen"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  {d.jabatan.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {d.jabatan.map((j) => (
                        <span key={j} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          {j}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-[11px] text-muted-foreground">Belum ada jabatan.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <SlideOverFooter onClose={onClose} pending={pending}>
        <Button variant="outline" onClick={onClose}>
          Selesai
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

/** One outlet row — memoized so toggling one item doesn't re-render the list. */
const OutletRow = React.memo(function OutletRow({
  id,
  name,
  active,
  onToggle,
}: {
  id: string;
  name: string;
  active: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(id)}
      className={cn(
        "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
        active ? "bg-primary/15 text-foreground ring-1 ring-inset ring-primary/30" : "hover:bg-muted",
      )}
    >
      <span className="truncate">{name}</span>
      {active && <Check className="size-4 shrink-0 text-primary" />}
    </button>
  );
});

/**
 * Outlet picker for a Coordinator Area (multi) or Supervisor (single). Self-
 * contained: fetches the POS branch list ONCE on mount, keeps its own selection
 * state, and reports changes up via a stable callback (a ref in the parent) — so
 * picking an outlet never re-renders the surrounding Add User form. Memoized so
 * unrelated form edits (typing name, etc.) don't re-render it either.
 */
const OutletAssignPicker = React.memo(function OutletAssignPicker({
  role,
  single,
  userId,
  fallback,
  defaultSelected,
  onSelectedChange,
}: {
  role: "area_coordinator" | "supervisor";
  single: boolean;
  userId?: string;
  fallback: AssignableOutlet[];
  defaultSelected: string[];
  onSelectedChange: (ids: string[]) => void;
}) {
  const [outlets, setOutlets] = React.useState<AssignableOutlet[] | null>(null);
  const [q, setQ] = React.useState("");
  // Single-outlet roles keep at most one selection even if seeded with more.
  const [selected, setSelected] = React.useState<string[]>(single ? defaultSelected.slice(0, 1) : defaultSelected);

  // Fetch the assignable POS outlets exactly once (per role).
  React.useEffect(() => {
    let live = true;
    listAssignableOutlets(role, userId).then((res) => {
      if (live && "outlets" in res) setOutlets(res.outlets);
    });
    return () => {
      live = false;
    };
  }, [role, userId]);

  // Report selection up (to the parent ref) whenever it changes.
  React.useEffect(() => {
    onSelectedChange(selected);
  }, [selected, onSelectedChange]);

  const toggle = React.useCallback(
    (id: string) => {
      setSelected((prev) => {
        if (single) return prev[0] === id ? [] : [id]; // radio-style: one outlet
        return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      });
    },
    [single],
  );

  const list = outlets ?? fallback;
  const loading = outlets === null;
  const selectedSet = React.useMemo(() => new Set(selected), [selected]);
  const filtered = React.useMemo(
    () => list.filter((o) => o.name.toLowerCase().includes(q.toLowerCase())),
    [list, q],
  );

  const label = single ? "Outlet Ditugaskan (1 outlet)" : `Wilayah / Outlet Ditugaskan (${selected.length})`;
  const hint = single
    ? "Supervisor hanya memegang 1 outlet. Outlet diambil dari sistem POS; yang sudah dipegang supervisor lain tidak ditampilkan."
    : "Outlet diambil dari sistem POS. Yang sudah dipegang koordinator lain tidak ditampilkan. Pilih 1 atau lebih.";

  return (
    <Field label={label}>
      <p className="mb-1.5 text-[11px] text-muted-foreground">
        {hint}
        {loading && <span className="ml-1 inline-flex items-center gap-1 text-muted-foreground/80"><Loader2 className="size-3 animate-spin" /> memuat dari POS…</span>}
      </p>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari outlet…" className="mb-2" />
      <div className="max-h-52 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1">
        {filtered.map((o) => (
          <OutletRow key={o.id} id={o.id} name={o.name} active={selectedSet.has(o.id)} onToggle={toggle} />
        ))}
        {filtered.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">Tidak ada outlet tersedia</p>}
      </div>
    </Field>
  );
});
