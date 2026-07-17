"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { getAssessmentSettingsData } from "@/lib/actions/assessment-settings";
import { AssessmentSettings, type AccountOption, type DeptOption } from "./settings";

type Data = {
  accounts: AccountOption[];
  departments: DeptOption[];
  initialRoster: Record<string, { role: "karyawan" | "head" | "director" | "hc"; scopeDepartmentId: string }>;
  initialAssignments: Record<string, { atasanUserId: string | null; peerUserIds: string[] }>;
};

/** Loads the settings data on demand (so the Pengaturan tab opens instantly),
 *  then renders the settings UI. Admin-only — returns null otherwise. */
export function SettingsPanel() {
  const [data, setData] = React.useState<Data | null | "denied">(null);

  React.useEffect(() => {
    let live = true;
    getAssessmentSettingsData().then((d) => { if (live) setData((d as Data) ?? "denied"); });
    return () => { live = false; };
  }, []);

  if (data === null) {
    return <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Memuat pengaturan…</div>;
  }
  if (data === "denied") {
    return <div className="py-16 text-center text-sm text-muted-foreground">Hanya Admin yang dapat membuka Pengaturan.</div>;
  }
  return (
    <AssessmentSettings
      accounts={data.accounts}
      departments={data.departments}
      initialRoster={data.initialRoster}
      initialAssignments={data.initialAssignments}
    />
  );
}
