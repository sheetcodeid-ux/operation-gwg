"use client";

import { Building2, Mail, Phone, ShieldCheck, Users, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ChatPerson, ChatThread } from "@/lib/chat-shared";

/**
 * Profil lawan bicara / anggota grup.
 *
 * Susunannya mengikuti kebiasaan aplikasi pesan: foto besar di tengah, nama,
 * lalu baris-baris data yang bisa dipindai cepat. Judul panel dibiarkan ke
 * pembungkusnya (panel geser atau kolom kanan) supaya kata "Profil" tidak
 * tercetak dua kali.
 */
export function DetailPanel({
  thread,
  people,
  showHeader = false,
  onClose,
  className,
}: {
  thread: ChatThread;
  people: ChatPerson[];
  /** Kolom kanan di layar lebar butuh judulnya sendiri; panel geser tidak. */
  showHeader?: boolean;
  onClose?: () => void;
  className?: string;
}) {
  const solo = thread.kind === "dm" ? people[0] : null;

  return (
    <aside className={cn("flex min-h-0 flex-col border-border bg-card", className)}>
      {showHeader && (
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
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {solo ? (
          <>
            <div className="flex flex-col items-center px-5 py-6 text-center">
              <Avatar name={solo.name} src={solo.avatarUrl} size={104} />
              <p className="mt-4 text-lg font-semibold leading-tight text-foreground">{solo.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{solo.jabatan || solo.roleLabel}</p>
            </div>

            <Section label="Informasi">
              <InfoRow icon={Building2} label="Departemen" value={solo.department || "—"} />
              <InfoRow icon={ShieldCheck} label="Peran" value={solo.roleLabel} />
              <InfoRow icon={Mail} label="Email" value={solo.email} href={`mailto:${solo.email}`} />
              <InfoRow
                icon={Phone}
                label="Telepon"
                value={solo.phone || "—"}
                href={solo.phone ? `tel:${solo.phone}` : undefined}
              />
            </Section>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center px-5 py-6 text-center">
              <span className="grid size-20 place-items-center rounded-full bg-brand-500/10 text-brand-600 ring-1 ring-border dark:text-brand-400">
                <Users className="size-9" />
              </span>
              <p className="mt-4 text-lg font-semibold leading-tight text-foreground">{thread.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Grup · {people.length + 1} anggota</p>
            </div>

            <Section label={`${people.length + 1} Anggota`}>
              {people.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-2.5">
                  <Avatar name={p.name} src={p.avatarUrl} size={40} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {[p.jabatan, p.department].filter(Boolean).join(" · ") || p.roleLabel}
                    </p>
                  </div>
                </div>
              ))}
            </Section>
          </>
        )}
      </div>
    </aside>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-2">
      <p className="px-5 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </section>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
}) {
  const body = (
    <>
      <Icon className="mt-0.5 size-[18px] shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className={cn("break-words text-sm", href ? "text-brand-600 dark:text-brand-400" : "text-foreground")}>
          {value}
        </p>
      </div>
    </>
  );

  if (href) {
    return (
      <a href={href} className="flex items-start gap-3 px-5 py-2.5 transition-colors hover:bg-muted/50">
        {body}
      </a>
    );
  }
  return <div className="flex items-start gap-3 px-5 py-2.5">{body}</div>;
}
