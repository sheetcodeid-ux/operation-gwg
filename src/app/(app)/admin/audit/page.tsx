import { redirect } from "next/navigation";
import { CalendarRange, Calculator, ConciergeBell, ListChecks, MessageSquareWarning, ScrollText, SprayCan } from "lucide-react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { getUsers, listComplaints, listEvents, listHospitality, listHygiene, listTasks, outletName } from "@/lib/data/store";
import { listHpp } from "@/lib/data/hpp";
import { listIngredients } from "@/lib/data/hpp-ingredients";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat";
import { AuditFeed, type AuditItem } from "@/components/admin/audit-feed";

export const metadata: Metadata = { title: "Audit Logs" };

export default async function AuditPage() {
  const user = (await getSessionUser())!;
  if (!can(user, "view_audit_logs")) redirect("/dashboard");

  const hosp = listHospitality(user);
  const hyg = listHygiene(user);
  const tasks = listTasks(user);
  const complaints = listComplaints(user);
  const evts = listEvents(user);
  const [hppMenus, ingredients] = await Promise.all([listHpp(), listIngredients()]);
  const userName = new Map(getUsers().map((u) => [u.id, u.name]));
  const rp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");

  // HPP activity, derived from stored records (menu lifecycle + ingredient prices).
  const hppItems: AuditItem[] = [
    ...hppMenus.map((m) => ({
      at: m.createdAt,
      type: "hpp" as const,
      text: `Menu HPP "${m.name}" dibuat${m.createdBy ? ` oleh ${userName.get(m.createdBy) ?? "—"}` : ""} · HPP ${rp(m.hpp)}`,
      outlet: m.brand,
    })),
    ...hppMenus
      .filter((m) => m.reviewedAt && (m.status === "verified" || m.status === "rejected"))
      .map((m) => ({
        at: m.reviewedAt as string,
        type: "hpp" as const,
        text: `Menu "${m.name}" ${m.status === "verified" ? "diverifikasi" : "ditolak"}${m.reviewedBy ? ` oleh ${userName.get(m.reviewedBy) ?? "tim F&B"}` : ""}${m.status === "rejected" && m.reviewNote ? ` — ${m.reviewNote}` : ""}`,
        outlet: m.brand,
      })),
    ...ingredients
      .filter((i) => i.prevPrice != null)
      .map((i) => ({
        at: i.updatedAt,
        type: "hpp" as const,
        text: `Harga bahan "${i.name}" diperbarui ke ${rp(i.buyPrice)}/${i.buyQty}${i.buyUnit}${i.alert ? " (naik >5%)" : ""}`,
        outlet: i.region || "Bahan Baku",
      })),
  ];

  const items: AuditItem[] = [
    ...hppItems,
    ...hosp.map((h) => ({
      at: h.date,
      type: "hospitality" as const,
      text: `Hospitality assessment for ${h.staffName} scored ${h.overallScore.toFixed(1)}`,
      outlet: outletName(h.outletId),
    })),
    ...hyg.map((h) => ({
      at: h.date,
      type: "hygiene" as const,
      text: `Hygiene audit recorded · score ${h.hygieneScore.toFixed(1)}`,
      outlet: outletName(h.outletId),
    })),
    ...tasks.map((t) => ({
      at: t.createdAt,
      type: "task" as const,
      text: `Task "${t.title}" set to ${t.status}`,
      outlet: t.outletId ? outletName(t.outletId) : "No branch",
    })),
    ...complaints.map((c) => ({
      at: c.createdAt,
      type: "complaint" as const,
      text: `Complaint logged via ${c.source.replace("_", " ")}`,
      outlet: outletName(c.outletId),
    })),
    ...evts.map((e) => ({
      at: e.createdAt,
      type: "event" as const,
      text: `Event "${e.name}" · ${e.status}`,
      outlet: outletName(e.outletId),
    })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader icon={ScrollText} title="Audit Logs" description="Recent operational activity across your scope" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatTile icon={ConciergeBell} label="Hospitality" value={hosp.length} sub="penilaian layanan" />
        <StatTile icon={SprayCan} label="Hygiene" value={hyg.length} sub="audit kebersihan" />
        <StatTile icon={ListChecks} label="Tasks" value={tasks.length} sub="work tracker" />
        <StatTile icon={MessageSquareWarning} label="Complaints" value={complaints.length} sub="keluhan" />
        <StatTile icon={CalendarRange} label="Events" value={evts.length} sub="event & milestone" />
        <StatTile icon={Calculator} label="HPP" value={hppItems.length} sub="aktivitas HPP" />
      </div>

      <div className="mt-4">
        <AuditFeed items={items.slice(0, 80)} />
      </div>
    </div>
  );
}
