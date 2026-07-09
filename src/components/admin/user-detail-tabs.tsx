"use client";

import * as React from "react";
import { CalendarDays, Clock, Mail, Phone, Shield, UserPlus, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UserDetail {
  username: string;
  name: string;
  email: string;
  roleLabel: string;
  division: string;
  createdLabel: string;
  phone: string | null;
  country: string | null;
}

export function UserDetailTabs({ u }: { u: UserDetail }) {
  const [tab, setTab] = React.useState<"basic" | "activity">("basic");

  return (
    <div className="mt-4">
      <div className="mb-4 flex gap-1 border-b border-border">
        <TabButton active={tab === "basic"} onClick={() => setTab("basic")}>
          Informasi Dasar
        </TabButton>
        <TabButton active={tab === "activity"} onClick={() => setTab("activity")}>
          Activity Logs
        </TabButton>
      </div>

      {tab === "basic" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="glass rounded-2xl border border-border p-5">
            <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Shield className="size-4 text-muted-foreground" /> Detail Akun
            </p>
            <dl className="space-y-4">
              <Row icon={UserIcon} label="Username" value={u.username} />
              <Row icon={UserIcon} label="Nama Lengkap" value={u.name} />
              <Row icon={Shield} label="Peran" value={`${u.roleLabel} · ${u.division}`} />
              <Row icon={CalendarDays} label="Akun Dibuat" value={u.createdLabel} />
            </dl>
          </div>

          <div className="glass rounded-2xl border border-border p-5">
            <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Mail className="size-4 text-muted-foreground" /> Informasi Kontak
            </p>
            <dl className="space-y-4">
              <Row icon={Mail} label="Alamat Email" value={u.email} />
              <Row icon={Phone} label="Nomor Telepon" value={u.phone || "Belum diisi"} muted={!u.phone} />
              <Row icon={UserIcon} label="Negara" value={u.country || "Belum diisi"} muted={!u.country} />
            </dl>
          </div>
        </div>
      ) : (
        <div className="glass rounded-2xl border border-border p-5">
          <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Clock className="size-4 text-muted-foreground" /> Aktivitas Akun
          </p>
          <ol className="relative space-y-4">
            <ActivityItem icon={UserPlus} title="Akun dibuat" time={u.createdLabel} />
            <li className="pl-9 text-sm text-muted-foreground">
              Belum ada aktivitas lain yang tercatat. Riwayat login &amp; perubahan akan tampil di sini seiring pemakaian.
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
        active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Row({ icon: Icon, label, value, muted }: { icon: typeof UserIcon; label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className={muted ? "text-sm text-muted-foreground" : "text-sm font-medium text-foreground"}>{value}</dd>
      </div>
    </div>
  );
}

function ActivityItem({ icon: Icon, title, time }: { icon: typeof UserIcon; title: string; time: string }) {
  return (
    <li className="flex items-start gap-3">
      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{time}</p>
      </div>
    </li>
  );
}
