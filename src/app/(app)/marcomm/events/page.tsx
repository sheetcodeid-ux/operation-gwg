import { Megaphone } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { listReviewableEvents, outletOptions, productOptions } from "@/lib/data/marcomm";
import { buildImpacts } from "@/lib/data/marcomm-analysis";
import { PageHeader } from "@/components/ui/page-header";
import { MarcommEvents } from "@/components/marcomm/events";

export const metadata: Metadata = { title: "Event Tracker · Marketing Communication" };

export default async function MarcommEventsPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "mc_events")) redirect("/dashboard");

  const [events, products, outlets, impacts] = await Promise.all([
    listReviewableEvents(),
    productOptions(),
    Promise.resolve(outletOptions()),
    buildImpacts(),
  ]);

  return (
    <div className="w-full">
      <PageHeader
        icon={Megaphone}
        title="Event & Promo Tracker"
        description="Event yang diajukan Coordinator Area masuk ke sini untuk di-ACC. Tetapkan budget, klasifikasikan promo (produk) atau event (outlet), lalu ukur dampak omzetnya."
      />
      <MarcommEvents events={events} products={products} outlets={outlets} impacts={impacts} />
    </div>
  );
}
