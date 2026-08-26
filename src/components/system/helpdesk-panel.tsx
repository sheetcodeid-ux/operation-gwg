"use client";

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
