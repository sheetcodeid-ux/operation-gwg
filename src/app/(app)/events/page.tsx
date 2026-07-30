import { CalendarRange } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { listReviewableEvents, outletOptions, productOptions } from "@/lib/data/marcomm";
import { PageHeader } from "@/components/ui/page-header";
import { MarcommEvents } from "@/components/marcomm/events";

export const metadata: Metadata = { title: "Event Tracker" };

export default async function EventsPage() {
  const user = (await getSessionUser())!;
  if (!canReachMenu(user, "events")) redirect("/dashboard");

  const [events, products, outlets] = await Promise.all([
    listReviewableEvents(),
    productOptions(),
    Promise.resolve(outletOptions()),
  ]);

  return (
    <div className="w-full">
      <PageHeader
        icon={CalendarRange}
        title="Event & Promo Tracker"
        description="Ajukan event (outlet) atau promo (produk) dengan form yang sama seperti Marketing Communication. Setelah diajukan, Marketing Communication akan meng-ACC dan menetapkan budget."
      />
      <MarcommEvents events={events} products={products} outlets={outlets} impacts={[]} canAcc={false} />
    </div>
  );
}
