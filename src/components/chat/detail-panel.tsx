"use client";

import { Building2, Mail, Phone, ShieldCheck, Users, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ChatPerson, ChatThread } from "@/lib/chat-shared";

/**
 * Kolom kanan: siapa lawan bicaranya.
 *
 * Untuk japri menampilkan profil orangnya; untuk grup menampilkan daftar
 * anggota. Isinya sengaja hanya data kantor (jabatan, departemen, kontak) —
 * itu yang dibutuhkan saat memutuskan apakah pesan ini sudah ke orang yang tepat.
 */
export function DetailPanel({
  thread,
  people,
  onClose,
  className,
}: {
  thread: ChatThread;
  people: ChatPerson[];
  onClose?: () => void;
  className?: string;
}) {
  const solo = thread.kind === "dm" ? people[0] : null;

  return (
    <aside className={cn("flex min-h-0 flex-col border-border bg-card", className)}>
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">
          {thread.kind === "group" ? "Anggota Grup" : "Profil"}
        </h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Tutup"
          >
            <X className="size-4" />
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {solo ? (
          <>
            <div className="flex flex-col items-center text-center">
              <Avatar name={solo.name} src={solo.avatarUrl} size={80} />
              <p className="mt-3 text-base font-semibold text-foreground">{solo.name}</p>
              <p className="text-xs text-muted-foreground">{solo.jabatan || solo.roleLabel}</p>
            </div>

            <p className="mb-2 mt-6 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Informasi
            </p>
            <dl className="space-y-1">
              <InfoRow icon={Building2} label="Departemen" value={solo.department || "—"} />
              <InfoRow icon={ShieldCheck} label="Peran" value={solo.roleLabel} />
              <InfoRow icon={Mail} label="Email" value={solo.email} />
              <InfoRow icon={Phone} label="Telepon" value={solo.phone || "—"} />
            </dl>
          </>
        ) : (
          <>
            <div className="mb-4 flex flex-col items-center text-center">
              <span className="grid size-16 place-items-center rounded-full bg-muted text-muted-foreground ring-1 ring-border">
                <Users className="size-7" />
              </span>
              <p className="mt-3 text-base font-semibold text-foreground">{thread.title}</p>
              <p className="text-xs text-muted-foreground">{people.length + 1} anggota</p>
            </div>

            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Anggota</p>
            <ul className="space-y-1">
              {people.map((p) => (
                <li key={p.id} className="flex items-center gap-2.5 rounded-lg px-1 py-1.5">
                  <Avatar name={p.name} src={p.avatarUrl} size={32} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {[p.jabatan, p.department].filter(Boolean).join(" · ") || p.roleLabel}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </aside>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg px-1 py-1.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <dt className="text-[10px] text-muted-foreground">{label}</dt>
        <dd className="break-words text-xs font-medium text-foreground">{value}</dd>
      </div>
    </div>
  );
}
