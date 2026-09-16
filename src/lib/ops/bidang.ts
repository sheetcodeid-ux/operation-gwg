import { DEPARTEMEN_PERFORMA, divisiDari, timSosialMedia } from "@/lib/nav";

/**
 * SIAPA YANG PUNYA WILAYAH — dan kenapa perannya tidak cukup untuk menjawabnya.
 *
 * Sampai sekarang hanya dua peran yang dipegangi outlet: Coordinator Area
 * (beberapa outlet) dan Supervisor (satu outlet). Keduanya peran tersendiri,
 * jadi "siapa yang punya wilayah" cukup ditanyakan ke `role`.
 *
 * Itu tidak lagi cukup. Orang Finance dan Marketing juga memegang wilayah —
 * Fetty memegang outletnya sendiri persis seperti Coordinator Area — tapi
 * perannya `member`, sama dengan seluruh staf kantor lain yang tidak memegang
 * apa pun. Yang membedakan DEPARTEMENNYA.
 *
 * SATU ATURAN YANG MENENTUKAN SELURUHNYA: siapa pun yang berhak membuka bidang
 * Performance V.1 boleh dipegangi outlet, dan begitu ia dipegangi outlet,
 * halamannya terkunci pada outlet itu saja.
 *
 * Sengaja TIDAK digantungkan pada jabatan, walau aturannya "hanya yang
 * berjabatan Finance yang punya wilayah". Jabatan diketik tangan di User
 * Management: yang jabatannya belum diisi — atau ditulis "Staff Finance",
 * "Finance Officer", apa pun — akan kehilangan pemilih outletnya sama sekali,
 * dan yang terlihat bukan "jabatannya salah" melainkan "fiturnya tidak jalan".
 * Aturan itu tetap berlaku, hanya ditegakkan dengan cara yang tidak bisa gagal
 * diam-diam: YANG TIDAK DIPEGANGI OUTLET MELIHAT SELURUH OUTLET. Kosongkan
 * outlet Accounting dan Tax, dan mereka memang tidak punya wilayah.
 *
 * Berkas ini MURNI — tanpa basis data — supaya dialog User Management bisa
 * memakainya tanpa menyeret lapisan server ke bundel peramban.
 */

export interface OrangBidang {
  department?: string | null;
  jabatan?: string | null;
}

/**
 * JABATAN PEMEGANG WILAYAH tiap bidang — bentuknya mengikuti Operational.
 *
 * Operational sudah lama memakai "Coordinator Area East" dan "Coordinator Area
 * West": wilayahnya terbaca dari jabatannya, bukan dari catatan terpisah yang
 * harus dicocokkan orang. Finance dan Marketing sekarang mengikuti bentuk yang
 * sama.
 *
 * TANPA KATA "AREA", dan itu bukan soal selera: `isCoordinator` di User
 * Management mengenali Coordinator Area dari pola "coordinator area", lalu
 * memaksa peran akunnya jadi `area_coordinator`. Jabatan Finance yang memuat
 * kata itu akan berubah jadi Coordinator Area operasional — beserta seluruh
 * menu operasional yang menyertainya.
 */
export const JABATAN_WILAYAH: Record<string, readonly string[]> = {
  "Finance V.1": ["Finance East", "Finance West"],
  "Marketing V.1": ["Marketing East", "Marketing West"],
};

/** Jabatan yang ditawarkan untuk departemen ini, kalau bidangnya punya. */
export function jabatanWilayahUntuk(department: string | null | undefined): readonly string[] {
  const b = bidangOrang({ department });
  return b ? JABATAN_WILAYAH[b] ?? [] : [];
}

/** Apakah JABATANNYA jabatan pemegang wilayah di bidangnya sendiri. */
export function jabatanPemegangWilayah(user: OrangBidang | null | undefined): boolean {
  const b = bidangOrang(user);
  if (!b) return false;
  const jabatan = (user?.jabatan ?? "").trim().toLowerCase();
  return (JABATAN_WILAYAH[b] ?? []).some((j) => j.toLowerCase() === jabatan);
}

/**
 * Bidang Performance V.1 tempat orang ini bekerja, kalau ada.
 *
 * Null berarti ia bukan orang Finance maupun Marketing — wilayahnya, kalau
 * punya, datang dari perannya (Coordinator Area, Supervisor).
 */
export function bidangOrang(user: OrangBidang | null | undefined): string | null {
  if (!user) return null;
  const divisi = divisiDari(user.department);
  for (const [bidang, departemen] of Object.entries(DEPARTEMEN_PERFORMA)) {
    if (divisi && departemen.includes(divisi)) return bidang;
  }
  // Departemennya Creative, pekerjaannya Marketing — lihat `DEPARTEMEN_PERFORMA`.
  return timSosialMedia(user) ? "Marketing V.1" : null;
}

/**
 * Boleh dipegangi outlet dari User Management, di luar peran yang sudah ada.
 *
 * DUA SYARAT, dan yang kedua adalah jaring pengaman. Syarat utamanya jabatan:
 * hanya Finance East/West dan Marketing East/West yang memegang wilayah —
 * Accounting dan Tax tidak, sesuai keputusan pemiliknya.
 *
 * Syarat keduanya: yang SUDAH dipegangi outlet tetap terbaca, apa pun
 * jabatannya sekarang. Tanpa itu, satu jabatan yang diganti akan membuat
 * penugasan yang sudah tersimpan diabaikan diam-diam — outletnya masih
 * tercatat atas namanya di basis data, tapi tidak muncul di layar mana pun,
 * dan tidak ada satu pun pesan yang menjelaskannya.
 */
export function bolehPunyaWilayah(
  user: (OrangBidang & { outletIds?: string[] | null }) | null | undefined,
): boolean {
  if (bidangOrang(user) === null) return false;
  return jabatanPemegangWilayah(user) || (user?.outletIds?.length ?? 0) > 0;
}

/**
 * Outlet yang dipegang orang ini — kosong berarti ia melihat SELURUH outlet.
 *
 * Kosong sengaja tidak diartikan "tidak melihat apa-apa". Halaman yang kosong
 * melompong tidak menjelaskan apa pun: yang membukanya akan mengira datanya
 * belum masuk, bukan mengira dirinya belum ditugaskan.
 */
export function wilayahOrang(user: (OrangBidang & { outletIds?: string[] | null }) | null | undefined): string[] {
  return bolehPunyaWilayah(user) ? [...(user?.outletIds ?? [])] : [];
}
