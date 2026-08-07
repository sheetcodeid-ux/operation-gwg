import { Table2 } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canOpenMenu } from "@/lib/nav";
import { canVerifyHpp } from "@/lib/hpp/access";
import { listHpp } from "@/lib/data/hpp";
import { PageHeader } from "@/components/ui/page-header";
import { HppRekap } from "@/components/hpp/hpp-rekap";

export const metadata: Metadata = { title: "Database HPP" };

export default async function HppRekapPage() {
  const user = await requireSessionUser();
  const canEdit =
    canOpenMenu(user.role, "hpp", user.grants) ||
    user.department === "Product Development & Quality" ||
    user.department === "Food & Beverage";
  if (!canEdit) redirect("/dashboard");

  // Only the R&D Head (or Super Admin) may verify/reject.
  const canVerify = canVerifyHpp(user);
  const records = await listHpp();

  return (
    <div className="w-full">
      <PageHeader
        icon={Table2}
        title="Database HPP"
        description="Rekap seluruh menu — HPP, harga jual, food cost & status verifikasi F&B"
      />
      <HppRekap records={records} canEdit={canEdit} canVerify={canVerify} />
    </div>
  );
}
