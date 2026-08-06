"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { HcRequest } from "@/lib/hc-request";
import { RequestEmpty, RequestList } from "./request-shared";

const LIMIT = 4;

/** Pengajuan terakhir departemen — datanya ikut dari halaman (tanpa muat ulang
 *  di sisi peramban) supaya halaman langsung tampil begitu dibuka. */
export function RecentRequests({ rows }: { rows: HcRequest[] }) {
  if (rows.length === 0) {
    return <RequestEmpty>Belum ada pengajuan. Pilih salah satu kategori di atas untuk membuat pengajuan pertama departemen Anda.</RequestEmpty>;
  }

  return (
    <div className="space-y-3">
      <RequestList rows={rows.slice(0, LIMIT)} />
      {rows.length > LIMIT && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" render={<Link href="/pengajuan/karyawan" prefetch />}>
            Permintaan karyawan
          </Button>
          <Button size="sm" variant="outline" render={<Link href="/pengajuan/pelatihan" prefetch />}>
            Pengajuan pelatihan
          </Button>
          <Button size="sm" variant="outline" render={<Link href="/pengajuan/design" prefetch />}>
            Pengajuan design
          </Button>
        </div>
      )}
    </div>
  );
}
