import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canOpenMenu } from "@/lib/nav";
import { getFraudReport } from "@/lib/data/fraud";
import { PageHeader } from "@/components/ui/page-header";
import { FraudAnalysis } from "@/components/operation/fraud-analysis";

export const metadata: Metadata = { title: "Analisis Fraud — Void & Cancel" };
// ESB generates the export asynchronously — allow the server room to poll for it.
export const maxDuration = 60;

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default async function FraudPage() {
  const user = (await getSessionUser())!;
  if (!canOpenMenu(user.role, "op_fraud", user.grants)) redirect("/dashboard");

  const today = ymd(new Date());
  const initial = await getFraudReport("daily", today);

  return (
    <div className="w-full">
      <PageHeader
        icon={ShieldAlert}
        title="Analisis Fraud — Void & Cancel"
        description="Pantau transaksi void, cancel & delete order per outlet (harian / mingguan / bulanan) dari data ESB. Lonjakan pada satu outlet menandakan potensi fraud."
      />
      <FraudAnalysis initial={initial} initialDate={today} />
    </div>
  );
}
