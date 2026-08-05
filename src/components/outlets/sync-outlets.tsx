"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { syncOutletsFromEsbAction } from "@/lib/actions/outlets";

/** Admin-only: pull any branch that exists in ESB but not yet in the app, so
 *  User Management / Work Tracker outlet pickers match the POS. */
export function SyncOutletsButton() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await syncOutletsFromEsbAction();
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.added.length === 0) {
        toast.success(`Sudah sinkron — ${res.esbTotal} cabang ESB semuanya ada.`);
      } else {
        toast.success(
          `${res.added.length} cabang ditambahkan: ${res.added.slice(0, 3).join(", ")}${res.added.length > 3 ? `, +${res.added.length - 3} lagi` : ""}`,
        );
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={run} disabled={busy} title="Tambahkan cabang ESB yang belum ada di aplikasi">
      {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Sinkron Cabang ESB
    </Button>
  );
}
