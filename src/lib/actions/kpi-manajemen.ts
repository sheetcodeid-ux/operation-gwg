"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu, type MenuKey } from "@/lib/nav";
import { simpanManajemen } from "@/lib/data/kpi-manajemen";
import type { DivisiKpi } from "@/lib/kpi/manajemen";

/**
 * Menyimpan isian tangan Kalkulator KPI Manajemen.
 *
 * Penjagaannya sama dengan menunya sendiri: hanya yang boleh membuka halaman
 * ini yang boleh menulis di dalamnya. Menyembunyikan tombolnya di layar tidak
 * menjaga apa pun — siapa pun yang bisa memanggil aksinya bisa menulis skor
 * manajemen seluruh perusahaan.
 */
export async function simpanManajemenAction(input: {
  periode: string;
  divisi: DivisiKpi[];
  labaBersih: number | null;
  salesManual: number | null;
  catatan: string;
}): Promise<{ ok?: true; error?: string }> {
  const user = await getSessionUser();
  if (!user || !canReachMenu(user, "kpi_manajemen" as MenuKey)) return { error: "Tidak punya akses." };
  if (!/^\d{4}-\d{2}$/.test(input.periode)) return { error: "Bulannya tidak dikenali." };

  // Nama divisi kosong berarti barisnya belum diisi — dibuang, bukan disimpan
  // sebagai divisi tanpa nama yang ikut menarik rata-rata.
  const divisi = input.divisi
    .map((d) => ({ nama: d.nama.trim(), nilai: Number(d.nilai) }))
    .filter((d) => d.nama !== "");
  if (divisi.some((d) => !Number.isFinite(d.nilai) || d.nilai < 0 || d.nilai > 100)) {
    return { error: "Nilai KPI divisi harus di antara 0 dan 100." };
  }
  const nama = new Set(divisi.map((d) => d.nama.toLowerCase()));
  if (nama.size !== divisi.length) return { error: "Ada nama divisi yang tertulis dua kali." };

  const angkaSah = (v: number | null) => v === null || (Number.isFinite(v) && v >= 0);
  if (!angkaSah(input.salesManual)) return { error: "Sales same store tidak boleh minus." };
  if (input.labaBersih !== null && !Number.isFinite(input.labaBersih)) return { error: "Laba bersih tidak terbaca." };

  const res = await simpanManajemen({
    periode: input.periode,
    divisi,
    labaBersih: input.labaBersih,
    salesManual: input.salesManual,
    catatan: input.catatan.slice(0, 2000),
    olehId: user.id,
    olehNama: user.name,
  });
  if (res.error) return { error: res.error };
  revalidatePath("/kpi/manajemen");
  return { ok: true };
}
