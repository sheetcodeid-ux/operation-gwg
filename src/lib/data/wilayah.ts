import { getUsers } from "./store";
import { bidangOrang, bolehPunyaWilayah } from "@/lib/ops/bidang";

/**
 * Pemegang wilayah tiap bidang Performance V.1 — sisi basis datanya.
 *
 * Aturan "siapa yang boleh punya wilayah" ada di `@/lib/ops/bidang`, yang
 * murni dan karena itu bisa dipakai dialog User Management di peramban.
 * Berkas ini yang menengok siapa saja orangnya.
 */

export interface PemegangWilayah {
  value: string;
  label: string;
  outlet: number;
}

/**
 * Orang-orang satu bidang yang memegang wilayah — isi penyaring "Area".
 *
 * Yang belum dipegangi outlet TIDAK didaftar: memilih namanya menghasilkan
 * tabel kosong, dan pilihan yang selalu kosong hanya membuat yang memilihnya
 * mengira ada yang rusak.
 */
export function daftarPemegangBidang(bidang: string): PemegangWilayah[] {
  return getUsers()
    .filter((u) => u.active !== false && (u.outletIds?.length ?? 0) > 0 && bidangOrang(u) === bidang)
    .map((u) => ({ value: u.id, label: u.name, outlet: (u.outletIds ?? []).length }))
    .sort((a, b) => a.label.localeCompare(b.label, "id"));
}

/** Outlet → pemegang wilayahnya di bidang itu. Dipakai Manajemen Outlet. */
export function pemegangTiapOutlet(bidang: string): Map<string, { id: string; nama: string }> {
  const peta = new Map<string, { id: string; nama: string }>();
  for (const u of getUsers()) {
    if (u.active === false || bidangOrang(u) !== bidang || !bolehPunyaWilayah(u)) continue;
    for (const id of u.outletIds ?? []) peta.set(id, { id: u.id, nama: u.name });
  }
  return peta;
}
