"use client";

import * as React from "react";
import { CalendarDays, Clock, KeyRound, Lock, Mail, Phone, Shield, UserPlus, User as UserIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export interface AccessEntry {
  section: string;
  label: string;
  source: "role" | "grant";
}

export interface UserDetail {
  username: string;
  name: string;
  email: string;
  roleLabel: string;
  division: string;
  createdLabel: string;
  phone: string | null;
  country: string | null;
  access: AccessEntry[];
}

export function UserDetailTabs({ u }: { u: UserDetail }) {
  const { t } = useI18n();
  const [tab, setTab] = React.useState<"basic" | "access" | "activity">("basic");
  const sections = [...new Set(u.access.map((a) => a.section))];

  return (
    <div className="mt-4">
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
        <TabButton active={tab === "basic"} onClick={() => setTab("basic")}>
          Informasi Dasar
        </TabButton>
        <TabButton active={tab === "access"} onClick={() => setTab("access")}>
          Hak Akses &amp; Menu
        </TabButton>
        <TabButton active={tab === "activity"} onClick={() => setTab("activity")}>
          Activity Logs
        </TabButton>
      </div>

      {tab === "basic" && (
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
      )}

      {tab === "access" && (
        <div className="glass rounded-2xl border border-border p-5">
          <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
            <KeyRound className="size-4 text-muted-foreground" /> Menu yang Dapat Diakses
          </p>
          <p className="mb-4 text-xs text-muted-foreground">
            Menu dari divisi asal (role) plus hak akses tambahan yang diberikan admin.
          </p>
          {sections.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Belum ada menu yang dapat diakses.</p>
          ) : (
            <div className="space-y-4">
              {sections.map((section) => (
                <div key={section}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{section}</p>
                  <div className="flex flex-wrap gap-2">
                    {u.access
                      .filter((a) => a.section === section)
                      .map((a) => (
                        <span
                          key={`${a.section}:${a.label}`}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium",
                            a.source === "role"
                              ? "border-border bg-muted/40 text-foreground"
                              : "border-primary/40 bg-primary/10 text-foreground",
                          )}
                        >
                          {a.source === "role" ? <Lock className="size-3 text-muted-foreground" /> : <KeyRound className="size-3 text-primary" />}
                          {t(`nav.${a.label}`)}
                          <span className="text-[10px] text-muted-foreground">{a.source === "role" ? "role" : "grant"}</span>
                        </span>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "activity" && (
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
        "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
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
