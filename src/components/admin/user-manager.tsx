"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, MoreHorizontal, Plus, Power, Store, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABEL } from "@/lib/constants";
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
import { Field, Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import type { Tone } from "@/lib/constants";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  areaId: string | null;
  outletIds: string[];
  active: boolean;
  scope: string;
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
};
const ROLES = Object.keys(ROLE_LABEL) as Role[];
const needsOutlets = (r: Role) => r === "area_coordinator" || r === "head_operation" || r === "pos_operation";
const isMulti = (r: Role) => r === "area_coordinator";

export function UserManager({ users, outlets }: { users: UserRow[]; outlets: OutletLite[] }) {
  const [creating, setCreating] = React.useState(false);
  const [resetUser, setResetUser] = React.useState<UserRow | null>(null);
  const [assignUser, setAssignUser] = React.useState<UserRow | null>(null);

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{users.length} users</p>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus /> New User
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="whitespace-nowrap border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2.5">User</th>
              <th className="px-3 py-2.5">Role</th>
              <th className="px-3 py-2.5">Scope</th>
              <th className="px-3 py-2.5 text-center">Status</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={u.name} size={32} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{u.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{u.scope}</td>
                <td className="px-3 py-2.5 text-center">
                  <Badge tone={u.active ? "success" : "danger"} dot>
                    {u.active ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <RowMenu
                    user={u}
                    onReset={() => setResetUser(u)}
                    onAssign={() => setAssignUser(u)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating && <NewUserDialog outlets={outlets} onClose={() => setCreating(false)} />}
      {resetUser && <ResetDialog user={resetUser} onClose={() => setResetUser(null)} />}
      {assignUser && needsOutlets(assignUser.role) && (
        <AssignDialog user={assignUser} outlets={outlets} onClose={() => setAssignUser(null)} />
      )}
    </>
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

function NewUserDialog({ outlets, onClose }: { outlets: OutletLite[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [form, setForm] = React.useState({ name: "", email: "", role: "pos_operation" as Role, password: "" });
  const [selected, setSelected] = React.useState<string[]>([]);

  function submit() {
    start(async () => {
      const res = await createUserAction({ ...form, outletIds: selected });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("User created");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="New User" description="Provision an account and assign access." className="max-w-lg">
        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full Name">
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Andi" />
            </Field>
            <Field label="Email (username)">
              <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="name@gwg.co" />
            </Field>
            <Field label="Role">
              <Combobox
                value={form.role}
                onChange={(v) => {
                  setForm((f) => ({ ...f, role: v as Role }));
                  setSelected([]);
                }}
                options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
              />
            </Field>
            <Field label="Initial Password">
              <Input type="text" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="min. 6 chars" />
            </Field>
          </div>

          {needsOutlets(form.role) && (
            <OutletPicker
              outlets={outlets}
              multi={isMulti(form.role)}
              selected={selected}
              onChange={setSelected}
            />
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <UserPlus />} Create User
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
              {pending && <Loader2 className="animate-spin" />} Reset
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
              {pending && <Loader2 className="animate-spin" />} Save
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
              className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                active ? "bg-primary/15 text-foreground ring-1 ring-inset ring-primary/30" : "hover:bg-muted"
              }`}
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
