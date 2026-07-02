"use client";

import * as React from "react";
import { CalendarRange, ConciergeBell, ListChecks, MessageSquareWarning, SprayCan, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { fromNow } from "@/lib/utils";

export type AuditType = "hospitality" | "hygiene" | "task" | "complaint" | "event";

export interface AuditItem {
  at: string;
  type: AuditType;
  text: string;
  outlet: string;
}

const META: Record<AuditType, { label: string; icon: LucideIcon }> = {
  hospitality: { label: "Hospitality", icon: ConciergeBell },
  hygiene: { label: "Hygiene", icon: SprayCan },
  task: { label: "Tasks", icon: ListChecks },
  complaint: { label: "Complaints", icon: MessageSquareWarning },
  event: { label: "Events", icon: CalendarRange },
};

export function AuditFeed({ items }: { items: AuditItem[] }) {
  const [type, setType] = React.useState<string>("all");
  const filtered = type === "all" ? items : items.filter((i) => i.type === type);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>Activity Feed</CardTitle>
        <Combobox
          className="min-w-0 shrink basis-44"
          value={type}
          onChange={setType}
          options={[
            { value: "all", label: "All activity" },
            ...(Object.keys(META) as AuditType[]).map((t) => ({ value: t, label: META[t].label })),
          ]}
          searchPlaceholder="Type…"
        />
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No activity</p>
        ) : (
          <div className="no-scrollbar max-h-[34rem] space-y-1 overflow-y-auto pl-2">
            {filtered.map((a, i) => {
              const Icon = META[a.type].icon;
              return (
                <div key={i} className="flex gap-3 rounded-xl px-2 py-2 hover:bg-muted/40">
                  <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted/50 ring-1 ring-border">
                    <Icon className="size-4 text-foreground/80" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">{a.text}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {a.outlet} · {fromNow(a.at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
