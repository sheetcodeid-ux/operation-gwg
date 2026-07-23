import { Scale } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canOpenMenu } from "@/lib/nav";
import { canVerifyHpp } from "@/lib/hpp/access";
import { getPriceComparison } from "@/lib/data/price-compare";
import { PageHeader } from "@/components/ui/page-header";
import { PriceReference } from "@/components/hpp/price-reference";

export const metadata: Metadata = { title: "Referensi Harga & HPP" };
// The manual ESB sync (menu-recap = ~124 pages) needs room to run.
export const maxDuration = 60;

export default async function PriceReferencePage() {
  const user = (await getSessionUser())!;
  const canEdit =
    canOpenMenu(user.role, "hpp", user.grants) ||
    user.department === "Product Development & Quality" ||
    user.department === "Food & Beverage";
  if (!canEdit) redirect("/dashboard");

  const { rows, esbSyncedAt } = await getPriceComparison();

  return (
    <div className="w-full">
      <PageHeader
        className="mb-3"
        icon={Scale}
        title="Referensi Harga & HPP"
        description="Bandingkan harga jual ESB dengan HPP terbaru per produk — pantau margin & produk yang terjual di bawah biaya pokok."
      />
      <PriceReference initial={rows} esbSyncedAt={esbSyncedAt} canSync={canVerifyHpp(user)} />
    </div>
  );
}
