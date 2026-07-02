"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPinned, Plus, Store } from "lucide-react";
import { toast } from "sonner";
import { createAreaAction, createOutletAction } from "@/lib/actions/org";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, useDialogControl } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";

interface UserLite {
  id: string;
  name: string;
}
interface AreaLite {
  id: string;
  name: string;
}

export function OrgActions({ users, areas }: { users: UserLite[]; areas: AreaLite[] }) {
  return (
    <div className="flex items-center gap-2">
      <Dialog>
        <DialogTrigger>
          <Button size="sm" variant="subtle">
            <MapPinned className="size-4" /> New Area
          </Button>
        </DialogTrigger>
        <DialogContent title="Wilayah Baru" description="Tambah wilayah koordinasi." align="center" className="max-w-md">
          <AreaForm users={users} />
        </DialogContent>
      </Dialog>
      <Dialog>
        <DialogTrigger>
          <Button size="sm" disabled={areas.length === 0} title={areas.length === 0 ? "Buat wilayah dulu" : undefined}>
            <Plus className="size-4" /> New Outlet
          </Button>
        </DialogTrigger>
        <DialogContent title="Outlet Baru" description="Tambah outlet/cabang ke sebuah wilayah." align="center" className="max-w-md">
          <OutletForm users={users} areas={areas} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AreaForm({ users }: { users: UserLite[] }) {
  const router = useRouter();
  const { setOpen } = useDialogControl();
  const [pending, start] = React.useTransition();
  const [form, setForm] = React.useState({ name: "", code: "", coordinatorId: users[0]?.id ?? "" });
  function submit() {
    start(async () => {
      const res = await createAreaAction(form);
      if (res?.error) return void toast.error(res.error);
      toast.success("Wilayah dibuat");
      setOpen(false);
      router.refresh();
    });
  }
  return (
    <div className="space-y-4 p-5">
      <Field label="Nama Wilayah">
        <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Jakarta Metro" />
      </Field>
      <Field label="Kode">
        <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="e.g. A1" />
      </Field>
      <Field label="Coordinator Area">
        <Combobox
          value={form.coordinatorId}
          onChange={(v) => setForm((f) => ({ ...f, coordinatorId: v }))}
          options={users.map((u) => ({ value: u.id, label: u.name }))}
          searchPlaceholder="Cari user…"
        />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
        <Button onClick={submit} disabled={pending}>{pending && <Loader2 className="animate-spin" />} Simpan</Button>
      </div>
    </div>
  );
}

function OutletForm({ users, areas }: { users: UserLite[]; areas: AreaLite[] }) {
  const router = useRouter();
  const { setOpen } = useDialogControl();
  const [pending, start] = React.useTransition();
  const [form, setForm] = React.useState({ name: "", code: "", city: "", areaId: areas[0]?.id ?? "", picId: users[0]?.id ?? "" });
  function submit() {
    start(async () => {
      const res = await createOutletAction(form);
      if (res?.error) return void toast.error(res.error);
      toast.success("Outlet dibuat");
      setOpen(false);
      router.refresh();
    });
  }
  return (
    <div className="space-y-4 p-5">
      <Field label="Nama Outlet">
        <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. GWG Bandung Dago" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kode">
          <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="e.g. A1-01" />
        </Field>
        <Field label="Kota">
          <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="e.g. Bandung" />
        </Field>
      </div>
      <Field label="Wilayah">
        <Combobox
          value={form.areaId}
          onChange={(v) => setForm((f) => ({ ...f, areaId: v }))}
          options={areas.map((a) => ({ value: a.id, label: a.name }))}
          searchPlaceholder="Cari wilayah…"
        />
      </Field>
      <Field label="PIC / Supervisor Outlet">
        <Combobox
          value={form.picId}
          onChange={(v) => setForm((f) => ({ ...f, picId: v }))}
          options={users.map((u) => ({ value: u.id, label: u.name }))}
          searchPlaceholder="Cari user…"
        />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
        <Button onClick={submit} disabled={pending}>{pending && <Loader2 className="animate-spin" />} <Store className="size-4" /> Simpan</Button>
      </div>
    </div>
  );
}
