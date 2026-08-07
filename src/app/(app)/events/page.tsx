import { CalendarRange } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { listReviewableEvents, outletOptions, productOptions } from "@/lib/data/marcomm";
import { PageHeader } from "@/components/ui/page-header";
import { MarcommEvents } from "@/components/marcomm/events";

export const metadata: Metadata = { title: "Event Tracker" };

export default async function EventsPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "events")) redirect("/dashboard");

  // A Supervisor may only propose for the branches they cover; head-office roles
  // (Coordinator Area, Operation) keep the full outlet list.
  const scoped = user.role === "supervisor";
  const [events, products, outlets] = await Promise.all([
    listReviewableEvents(),
    productOptions(),
    Promise.resolve(outletOptions(scoped ? user : undefined)),
  ]);

  return (
    <div className="w-full">
      <PageHeader
        icon={CalendarRange}
        title="Event & Promo Tracker"
        description="Ajukan event (outlet) atau promo (produk) lengkap dengan lampiran PDF/PNG. Setelah diajukan, Marketing Communication akan meng-ACC dan menetapkan budget."
      />
      <MarcommEvents events={events} products={products} outlets={outlets} impacts={[]} canAcc={false} />
    </div>
  );
}
