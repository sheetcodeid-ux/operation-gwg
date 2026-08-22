"use client";

// Dikecualikan dari React Compiler.
//
// Antrian System dan Antrian IT Help Desk berulang kali menabrak React error
// #310 di produksi — jumlah hook yang dirender berubah antar-render. Pemeriksa
// aturan hook TIDAK menemukan satu pun pelanggaran di berkas-berkas ini, jadi
// urutan hook di sumbernya memang benar; yang berbeda adalah keluaran
// kompilernya. Berkas ini juga memakai TanStack Table, yang kompilernya sendiri
// tandai "incompatible library".
//
// Dilepas dari kompiler, bukan ditambal dengan penjaga: menambal gejalanya
// berarti menebak, sementara yang pasti adalah halamannya harus berhenti
// mogok untuk orang yang mengerjakan tiket sehari-hari.
"use no memo";

import * as React from "react";
import { Inbox, Table2 } from "lucide-react";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { SystemReviewPanel } from "@/components/system/system-review";
import { HelpdeskTabel } from "@/components/system/helpdesk-tabel";
import type { SystemRequest } from "@/lib/system-shared";

/**
 * Dua cara memandang antrian yang sama, karena keduanya menjawab pertanyaan
 * berbeda dan tidak bisa saling menggantikan.
 *
 *  • Antrean — untuk MENGERJAKAN satu tiket: buka, baca lampirannya, tentukan
 *    penanggung jawab, tutup.
 *  • Papan Tiket — untuk MENGAWASI semuanya sekaligus: mana yang belum
 *    disentuh, siapa pegang apa, berapa lama orang menunggu.
 *
 * Memaksakan keduanya jadi satu tampilan membuat yang satu selalu berdesakan.
 */
export function HelpdeskPanel({
  rows,
  handlers,
  canDelete = false,
}: {
  rows: SystemRequest[];
  handlers: { id: string; name: string }[];
  canDelete?: boolean;
}) {
  const [tab, setTab] = React.useState("antrean");

  return (
    <div className="space-y-4">
      <SegmentedTabs
        items={[
          { value: "antrean", label: "Antrean", icon: Inbox },
          { value: "papan", label: "Papan Tiket", icon: Table2 },
        ]}
        value={tab}
        onChange={setTab}
        className="max-w-sm"
      />
      {tab === "antrean" ? (
        <SystemReviewPanel rows={rows} handlers={handlers} canDelete={canDelete} />
      ) : (
        <HelpdeskTabel rows={rows} />
      )}
    </div>
  );
}
