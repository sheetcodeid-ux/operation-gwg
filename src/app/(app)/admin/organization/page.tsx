import { redirect } from "next/navigation";
import { MapPinned, Network, Store, UserCog } from "lucide-react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { getAreas, getOutlets, userName } from "@/lib/data/store";
import { can } from "@/lib/rbac";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat";

export const metadata: Metadata = { title: "Organization" };

export default async function OrganizationPage() {
  const user = (await getSessionUser())!;
  if (!can(user, "manage_org")) redirect("/dashboard");

  const areas = getAreas();
  const outlets = getOutlets();
  const coordinators = new Set(areas.map((a) => a.coordinatorId)).size;
  const activeOutlets = outlets.filter((o) => o.active).length;

  return (
    <div className="w-full">
      <PageHeader icon={Network} title="Organization" description="Areas, coordinators and outlet assignments" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={MapPinned} label="Areas" value={areas.length} tone="brand" />
        <StatTile icon={Store} label="Outlets" value={outlets.length} tone="cyan" />
        <StatTile icon={Store} label="Active Outlets" value={activeOutlets} tone="success" />
        <StatTile icon={UserCog} label="Coordinators" value={coordinators} tone="amber" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {areas.map((area) => {
          const areaOutlets = outlets.filter((o) => o.areaId === area.id);
          return (
            <Card key={area.id}>
              <CardHeader className="flex-row items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Avatar name={userName(area.coordinatorId)} size={36} />
                  <div>
                    <CardTitle>{area.name}</CardTitle>
                    <p className="text-[11px] text-muted-foreground">
                      <UserCog className="mr-1 inline size-3" />
                      {userName(area.coordinatorId)} · {area.code}
                    </p>
                  </div>
                </div>
                <Badge tone="cyan">
                  <Store className="size-3" /> {areaOutlets.length}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {areaOutlets.map((o) => (
                    <span
                      key={o.id}
                      className="rounded-md border border-border bg-muted/30 px-2 py-1 text-[11px] text-foreground/80"
                      title={`${o.name} · ${o.city}`}
                    >
                      {o.code}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
