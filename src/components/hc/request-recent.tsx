"use client";

import * as React from "react";
import Link from "next/link";
import { Inbox, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/page-header";
import { myHcRequestsAction } from "@/lib/actions/hc-requests";
import type { HcRequest } from "@/lib/hc-request";
import { RequestList } from "./request-shared";

const LIMIT = 4;

/** Empat pengajuan terakhir departemen — pintasan dari halaman Pengajuan. */
export function RecentRequests() {
  const [rows, setRows] = React.useState<HcRequest[] | null>(null);

  React.useEffect(() => {
    void myHcRequestsAction().then(setRows);
  }, []);

  if (rows === null) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Memuat pengajuan…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Belum ada pengajuan"
        description="Pilih salah satu kategori di atas untuk membuat pengajuan pertama departemen Anda."
      />
    );
  }

  return (
    <div className="space-y-3">
      <RequestList rows={rows.slice(0, LIMIT)} />
      {rows.length > LIMIT && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" render={<Link href="/pengajuan/karyawan" />}>
            Lihat permintaan karyawan
          </Button>
          <Button size="sm" variant="outline" render={<Link href="/pengajuan/pelatihan" />}>
            Lihat pengajuan pelatihan
          </Button>
        </div>
      )}
    </div>
  );
}
