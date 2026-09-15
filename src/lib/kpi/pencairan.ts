import type { DepartemenKpi } from "./manajemen";

/**
 * DAFTAR PENCAIRAN KPI — siapa dapat berapa, dan cair berapa persen.
 *
 * Berbeda dari rapor KPI yang sudah ada. Rapor menjawab "kenapa skornya
 * segini"; berkas ini menjawab satu pertanyaan yang muncul sekali sebulan di
 * meja yang membayar: cair atau tidak, dan berapa.
 *
 * Tiga aturan yang menentukan seluruh isinya, dan ketiganya keputusan pemilik:
 *
 *  1. CAPAIAN PERSONAL adalah KPI orangnya sendiri. Abil 83% berarti 83%.
 *
 *  2. CAPAIAN DIVISI adalah rata-rata KPI orang-orang di divisi itu — dan itu
 *     pula KPI Head-nya. Head tidak dinilai dengan indikatornya sendiri:
 *     pekerjaannya memang hasil kerja timnya, jadi angkanya diambil dari sana.
 *
 *  3. YANG MENENTUKAN CAIR adalah rata-rata keduanya. Bukan salah satunya:
 *     capaian pribadi saja membuat orang di divisi yang berantakan tetap cair
 *     penuh, dan capaian divisi saja membuat yang bekerja keras di divisi yang
 *     tertinggal ikut tidak cair. Untuk Head kedua angkanya sama, jadi
 *     rata-ratanya angka itu juga.
 */

/** Ambang pencairan — keputusan pemilik, bukan turunan dari apa pun. */
export const AMBANG_PENUH = 86;
export const AMBANG_SEPARUH = 62;

export type Pencairan = "penuh" | "separuh" | "tidak";

export interface HasilCair {
  jenis: Pencairan;
  /** Berapa persen yang cair: 100, 50, atau 0. */
  persen: number;
  label: string;
}

/**
 * Cair berapa, dari satu angka dasar.
 *
 * DI ATAS 100 TETAP CAIR PENUH. Capaian bisa melewati seratus saat targetnya
 * terlampaui, dan aturan tertulisnya berhenti di "86% – 100%". Membaca batas
 * atas itu sebagai syarat akan membuat yang paling berprestasi justru tidak
 * cair — jelas bukan yang dimaksud.
 *
 * ANTARA 85 DAN 86 dihitung separuh. Aturannya menyisakan celah di situ
 * (62–85, lalu 86–100); yang dipakai di sini "86 ke atas", jadi 85,4% masuk
 * separuh. Celah itu disebut apa adanya supaya tidak ditemukan ulang tiap
 * kali ada yang mendarat di antaranya.
 */
export function hasilCair(dasar: number | null): HasilCair | null {
  if (dasar === null || !Number.isFinite(dasar)) return null;
  if (dasar >= AMBANG_PENUH) return { jenis: "penuh", persen: 100, label: "100% cair" };
  if (dasar >= AMBANG_SEPARUH) return { jenis: "separuh", persen: 50, label: "50% cair" };
  return { jenis: "tidak", persen: 0, label: "Tidak cair" };
}

/** Rata-rata yang MENGABAIKAN yang belum ada angkanya — bukan menganggapnya nol. */
export function rata(xs: readonly (number | null)[]): number | null {
  const ada = xs.filter((x): x is number => x !== null && Number.isFinite(x));
  return ada.length ? ada.reduce((a, b) => a + b, 0) / ada.length : null;
}

/**
 * Departemen tempat tiap Head duduk, dari nama departemen di User Management.
 *
 * Dua nama yang tidak sama persis dengan nama departemen KPI, dan keduanya
 * disengaja: kode `hrd` dipertahankan supaya riwayat KPI-nya tidak putus,
 * sedangkan "Finance Accounting Tax" adalah nama panjang yang dipakai
 * perusahaan untuk departemen yang di KPI bernama Finance.
 */
export const DEPT_DARI_DIVISI: Record<string, string> = {
  "Operational": "operational",
  "Creative": "creative",
  "Finance Accounting Tax": "finance",
  "Finance": "finance",
  "Product Development & Quality": "pdq",
  "Marketing Communication": "marcomm",
  "Sosial Media": "sosmed",
  "Human Capital": "hrd",
};

/**
 * Head yang divisinya BELUM punya modul KPI, dan divisi mana yang dipinjamnya.
 *
 * Business Development belum dinilai sama sekali. Keputusan pemilik: sementara
 * ini capaian Head-nya mengikuti Operational. Ditulis di sini sebagai
 * pengecualian bernama, bukan disembunyikan di dalam perhitungan — supaya saat
 * Business Development punya KPI-nya sendiri, yang perlu dihapus satu baris dan
 * ketahuan dari daftarnya sendiri.
 */
export const PINJAM_DIVISI: Record<string, string> = {
  "Business Development": "operational",
};

export interface BarisCair {
  nama: string;
  /** Nama divisi sebagaimana dibaca orang, bukan kodenya. */
  departemen: string;
  /** Benar bila ia Head divisinya. */
  head: boolean;
  /** KPI orangnya sendiri. Untuk Head, sama dengan capaian divisi. */
  personal: number | null;
  /** Rata-rata KPI orang-orang di divisinya. */
  divisi: number | null;
  /** Rata-rata personal dan divisi — inilah yang menentukan pencairannya. */
  dasar: number | null;
  hasil: HasilCair | null;
  /** Kenapa angkanya kosong, kalau kosong. Ikut dicetak supaya yang membayar
   *  tahu ini bukan nol. */
  alasan?: string;
}

export interface HeadDivisi {
  nama: string;
  /** Nama departemen orangnya di User Management. */
  divisi: string;
}

/**
 * Susun seluruh baris daftar pencairan.
 *
 * `departemen` datang apa adanya dari Detail KPI Divisi, jadi yang tampil di
 * kertas tidak bisa berbeda dari yang tampil di layar — dua sumber angka untuk
 * satu pertanyaan adalah cara paling mudah membayar orang dengan angka yang
 * tidak pernah dilihat siapa pun.
 */
export function barisPencairan(departemen: readonly DepartemenKpi[], heads: readonly HeadDivisi[]): BarisCair[] {
  // Rata-rata divisi dihitung dari ORANGNYA, bukan dari posisinya. Pemiliknya
  // menyebutnya begitu ("rata-rata dari nilai mereka"), dan dua cara itu
  // memberi angka berbeda saat satu posisi berisi empat orang dan posisi lain
  // berisi satu.
  const rataDept = new Map<string, number | null>();
  const namaDept = new Map<string, string>();
  for (const d of departemen) {
    namaDept.set(d.kode, d.nama);
    rataDept.set(d.kode, rata(d.posisi.flatMap((p) => p.orang.map((o) => o.nilai))));
  }

  const baris: BarisCair[] = [];
  for (const d of departemen) {
    const nilaiDivisi = rataDept.get(d.kode) ?? null;
    for (const p of d.posisi) {
      for (const o of p.orang) {
        // TANPA CAPAIAN PERSONAL, PENCAIRANNYA TIDAK DIPUTUSKAN DI SINI.
        //
        // Rata-rata di berkas ini memang mengabaikan yang kosong, tapi menerapkan
        // itu pada satu orang tanpa angka berarti ia dibayar semata-mata atas
        // hasil kerja timnya — keputusan yang harus diambil orang, bukan
        // diam-diam oleh rumus. Barisnya tetap tercetak dengan alasannya supaya
        // yang membayar melihatnya, bukan hilang dari daftar.
        const dasar = o.nilai === null ? null : rata([o.nilai, nilaiDivisi]);
        baris.push({
          nama: o.nama,
          departemen: d.nama,
          head: false,
          personal: o.nilai,
          divisi: nilaiDivisi,
          dasar,
          hasil: hasilCair(dasar),
          alasan: o.nilai === null ? "Capaian personalnya belum ada — pencairannya perlu diputuskan manual." : undefined,
        });
      }
    }
  }

  // Nama divisi → kode, supaya Head yang departemennya ditulis persis seperti
  // nama divisi KPI tetap ketemu walau belum terdaftar di `DEPT_DARI_DIVISI`.
  // Tanpa ini, satu nama divisi yang berubah membuat Head-nya diam-diam
  // "belum dinilai" — kosong yang terbaca seperti data hilang, bukan seperti
  // pemetaan yang perlu ditambah.
  const kodeDariNama = new Map([...namaDept].map(([kode, nama]) => [nama, kode]));

  for (const h of heads) {
    const pinjam = PINJAM_DIVISI[h.divisi];
    const kode = DEPT_DARI_DIVISI[h.divisi] ?? kodeDariNama.get(h.divisi);
    const dipakai = kode ?? pinjam;
    const nilai = dipakai ? rataDept.get(dipakai) ?? null : null;
    // DIVISI YANG TIDAK ADA DI DETAIL KPI DIVISI TIDAK IKUT TERCETAK.
    //
    // Supply Chain belum punya modul KPI: anak buahnya pun tidak muncul di
    // layar, jadi Head-nya muncul sendirian di kertas sebagai baris kosong yang
    // tidak bisa ditindaklanjuti siapa pun. Keputusan pemilik: yang belum
    // punya KPI jangan ditampilkan sama sekali.
    //
    // Yang punya pinjaman TETAP IKUT — angkanya ada, dan asalnya disebutkan.
    if (nilai === null) continue;
    baris.push({
      nama: h.nama,
      // Divisinya ditulis dengan NAMA YANG SAMA dengan anak buahnya. "Finance
      // Accounting Tax" di sebelah "Finance" terbaca seperti dua divisi yang
      // berbeda, dan yang membaca akan mencari divisi kedua yang tidak ada.
      departemen: (kode ? namaDept.get(kode) : undefined) ?? h.divisi,
      head: true,
      // Head dinilai dari rata-rata divisinya, jadi kedua kolomnya angka yang
      // sama — dan rata-ratanya pun angka itu. Ditulis dua kali dengan sengaja:
      // kertasnya dibaca berdampingan dengan baris anggota, dan kolom yang
      // kosong di baris Head akan terbaca sebagai data yang hilang.
      personal: nilai,
      divisi: nilai,
      dasar: nilai,
      hasil: hasilCair(nilai),
      alasan:
        pinjam && !kode ? `Divisinya belum punya KPI — sementara mengikuti ${namaDept.get(pinjam) ?? pinjam}.` : undefined,
    });
  }

  return baris;
}
