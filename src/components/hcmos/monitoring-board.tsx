"use client";

import * as React from "react";
import { NAV_ICONS } from "@/components/layout/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat";
import {
  BilahModul,
  KerangkaModul,
  useLayarPenuh,
} from "@/components/hcmos/kit-modul";
import { GrafikBatang, GrafikDonat, GrafikGaris } from "./grafik";
import type { TabMonitoring } from "@/lib/data/hcmos-monitoring";
import { ChartColumnBig, Gauge } from "lucide-react";

/**
 * Dashboard Monitoring — sebelas tab metrik.
 *
 * Tabnya digulir mendatar di layar sempit, bukan dipaksa muat: sebelas tab yang
 * diperas jadi selebar layar HP menyisakan label satu-dua huruf yang tidak bisa
 * dibaca siapa pun.
 */
export function MonitoringBoard({ tabs }: { tabs: TabMonitoring[] }) {
  const [aktif, setAktif] = React.useState(tabs[0]?.key ?? "");
  const { bingkai, layarPenuh, alih } = useLayarPenuh();
  const tab = tabs.find((t) => t.key === aktif) ?? tabs[0];
  if (!tab) return null;

  const kosong = tab.angka.every((a) => a.nilai === 0 || a.nilai === "0" || a.nilai === "0%" || a.nilai === "—");

  // Berapa metrik yang benar-benar sudah punya angka. Ini yang paling sering
  // ditanyakan saat dashboard terlihat sepi: "datanya belum masuk, atau
  // memang nol?" — dan keduanya keadaan yang sangat berbeda.
  const adaIsi = tabs.filter(
    (t) => !t.angka.every((a) => a.nilai === 0 || a.nilai === "0" || a.nilai === "0%" || a.nilai === "—"),
  ).length;

  return (
    <KerangkaModul ref={bingkai}>
      {/* Tanpa kotak cari: isinya sebelas metrik yang seluruhnya sudah terlihat
          di deret tab. Yang dicari orang di sini adalah metriknya, dan metriknya
          memang sudah berjajar. */}
      <BilahModul
        ikon={Gauge}
        gradien="from-orange-500 via-amber-500 to-yellow-500 shadow-amber-500/20"
        judul={tab.label}
        ringkas={
          <>
            {tabs.length} metrik HR · {adaIsi} sudah punya data · seluruhnya dihitung dari modul, tidak diketik
          </>
        }
        panduan="monitoring"
        layarPenuh={layarPenuh}
        onLayarPenuh={alih}
      />

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-3">
      <div className="scroll-fade-x -mx-1 flex gap-1.5 overflow-x-auto px-1 py-1">
        {tabs.map((t) => {
          const Icon = NAV_ICONS[t.ikon] ?? ChartColumnBig;
          const on = t.key === aktif;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setAktif(t.key)}
              aria-pressed={on}
              className={
                on
                  ? "inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm ring-1 ring-border"
                  : "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }
            >
              <Icon className="size-4" /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tab.angka.map((a) => (
          <StatTile key={a.label} icon={NAV_ICONS[tab.ikon] ?? ChartColumnBig} label={a.label} value={a.nilai} sub={a.catatan} />
        ))}
      </div>

      {kosong && tab.catatanKosong && (
        <p className="rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-[12px] text-muted-foreground">
          {tab.catatanKosong}
        </p>
      )}

      {tab.tabel && tab.tabel.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>{tab.tabelJudul}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted text-left text-xs text-muted-foreground">
                    {(tab.tabelKepala ?? []).map((k) => (
                      <th key={k} className="px-3 py-2.5 font-medium">
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tab.tabel.map((b, i) => (
                    <tr key={i} className="border-b border-border/60 last:border-0">
                      {b.kolom.map((c, j) => (
                        <td key={j} className={j === 0 ? "px-3 py-2 text-foreground" : "px-3 py-2 text-muted-foreground"}>
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {tab.grafik.map((g) =>
          g.bentuk === "donat" ? (
            <GrafikDonat key={g.judul} judul={g.judul} subjudul={g.subjudul} data={g.data} />
          ) : g.bentuk === "garis" ? (
            <GrafikGaris key={g.judul} judul={g.judul} subjudul={g.subjudul} data={g.data} />
          ) : (
            <GrafikBatang
              key={g.judul}
              judul={g.judul}
              subjudul={g.subjudul}
              data={g.data}
              // Sumbu yang isinya periode disingkat jadi nama bulan, bukan
              // huruf awal — "2026-08" tidak berarti apa pun sebagai "20".
              periode={/periode|bulan/i.test(g.judul)}
            />
          ),
        )}
      </div>
      </div>
    </KerangkaModul>
  );
}
