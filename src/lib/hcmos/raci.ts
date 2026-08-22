import { RACI_ROLES, allSubmenus, type RaciEntry, type RaciRole } from "./pillars";

/**
 * Matriks RACI — siapa memegang peran apa atas tiap aktivitas HC-MOS.
 *
 * Isinya berasal dari dua sumber yang sengaja dipisah:
 *
 *  • BAWAAN — matriks Juknis Bab 8, tertulis di `pillars.ts`. Ini yang berlaku
 *    selama belum ada yang mengubahnya, dan ia tidak pernah hilang: apa pun
 *    yang terjadi pada suntingan, susunan aslinya selalu bisa dikembalikan.
 *  • SUNTINGAN — perubahan yang disimpan Human Capital lewat layar RACI.
 *
 * Menyimpan HANYA yang berbeda dari bawaan, bukan menyalin seluruh matriks ke
 * basis data, punya satu akibat yang menentukan: saat Juknis bertambah pilar
 * atau sub-menu baru, baris barunya langsung muncul membawa RACI bawaannya —
 * tidak menunggu seseorang mengetik ulang. Kalau seluruh matriks disalin,
 * setiap penambahan di Juknis akan meninggalkan baris kosong yang tidak ada
 * yang tahu harus diisi siapa.
 */

export type { RaciRole, RaciEntry };
export { RACI_ROLES };

/** Satu baris matriks: satu aktivitas beserta pemegang keempat perannya. */
export interface BarisRaci {
  pilarSlug: string;
  pilarLabel: string;
  pilarPic: string;
  subSlug: string;
  subLabel: string;
  fungsi: string;
  href?: string;
  raci: RaciEntry;
  /** Peran yang isinya berbeda dari matriks Juknis. */
  disunting: RaciRole[];
}

/** Satu suntingan tersimpan. */
export interface SuntinganRaci {
  pilarSlug: string;
  subSlug: string;
  peran: RaciRole;
  pemegang: string;
}

export const kunciRaci = (pilarSlug: string, subSlug: string, peran: RaciRole) =>
  `${pilarSlug}::${subSlug}::${peran}`;

/** Tanda "tidak ada pemegang" seperti yang ditulis di matriks Juknis. */
export const KOSONG = "—";

/**
 * Nama-nama pada satu sel.
 *
 * Satu sel bisa memuat beberapa orang ("Uswatun, Head of Operation") dan
 * dipisah koma persis seperti matriks aslinya. Dipecah di sini, sekali, supaya
 * tiap layar tidak memakai aturan pemisahnya sendiri — pernah terjadi satu
 * layar memperlakukan seluruh isi sel sebagai SATU nama, sehingga "Uswatun"
 * tidak pernah ditemukan pencarian di baris yang jelas-jelas memuat namanya.
 */
export function pecahNama(sel: string | null | undefined): string[] {
  const teks = (sel ?? "").trim();
  if (!teks || teks === KOSONG) return [];
  return teks
    .split(/\s*[,;/]\s*|\s+dan\s+/i)
    .map((n) => n.trim())
    .filter((n) => n && n !== KOSONG);
}

/** Kebalikannya — dipakai saat menyimpan hasil suntingan. */
export function gabungNama(nama: string[]): string {
  const bersih = [...new Set(nama.map((n) => n.trim()).filter(Boolean))];
  return bersih.length ? bersih.join(", ") : KOSONG;
}

/**
 * Matriks lengkap: bawaan Juknis, ditimpa suntingan yang tersimpan.
 *
 * Suntingan yang menunjuk aktivitas yang sudah tidak ada di Juknis diabaikan
 * begitu saja — bukan dibuang dari basis data. Sub-menu bisa hilang sementara
 * karena kerangka sedang disusun ulang, dan menghapus suntingannya saat itu
 * berarti pekerjaan orang ikut terhapus tanpa ada yang memintanya.
 */
export function susunMatriks(suntingan: SuntinganRaci[] = []): BarisRaci[] {
  const peta = new Map(suntingan.map((s) => [kunciRaci(s.pilarSlug, s.subSlug, s.peran), s.pemegang]));

  return allSubmenus().map(({ pillar, sub }) => {
    const raci = { ...sub.raci } as RaciEntry;
    const disunting: RaciRole[] = [];
    for (const peran of RACI_ROLES) {
      const ganti = peta.get(kunciRaci(pillar.slug, sub.slug, peran));
      if (ganti !== undefined && ganti !== sub.raci[peran]) {
        raci[peran] = ganti;
        disunting.push(peran);
      }
    }
    return {
      pilarSlug: pillar.slug,
      pilarLabel: pillar.label,
      pilarPic: pillar.pic,
      subSlug: sub.slug,
      subLabel: sub.label,
      fungsi: sub.fungsi,
      href: sub.href,
      raci,
      disunting,
    };
  });
}

/** Seluruh nama yang muncul di matriks, urut abjad — untuk saringan & pilihan. */
export function semuaNama(baris: BarisRaci[]): string[] {
  const set = new Set<string>();
  for (const b of baris) for (const p of RACI_ROLES) for (const n of pecahNama(b.raci[p])) set.add(n);
  return [...set].sort((a, b) => a.localeCompare(b, "id"));
}

/* ─────────────────────────── membaca per orang ───────────────────────────
 * Matriks menjawab "aktivitas ini siapa yang pegang?". Pertanyaan yang justru
 * lebih sering diajukan adalah kebalikannya — "saya pegang apa saja?" — dan
 * tabel 32 baris kali 4 kolom tidak menjawabnya tanpa dibaca satu per satu.  */

export interface TugasOrang {
  peran: RaciRole;
  baris: BarisRaci;
}

export interface RingkasOrang {
  nama: string;
  tugas: TugasOrang[];
  /** Berapa aktivitas per peran — R dan A yang paling menentukan beban. */
  jumlah: Record<RaciRole, number>;
  total: number;
}

export function perOrang(baris: BarisRaci[]): RingkasOrang[] {
  const peta = new Map<string, TugasOrang[]>();
  for (const b of baris) {
    for (const peran of RACI_ROLES) {
      for (const nama of pecahNama(b.raci[peran])) {
        peta.set(nama, [...(peta.get(nama) ?? []), { peran, baris: b }]);
      }
    }
  }

  const hasil = [...peta].map(([nama, tugas]) => {
    const jumlah = { R: 0, A: 0, C: 0, I: 0 } as Record<RaciRole, number>;
    for (const t of tugas) jumlah[t.peran] += 1;
    return { nama, tugas, jumlah, total: tugas.length };
  });

  // Diurutkan menurut beban yang benar-benar menuntut kerja: Accountable lebih
  // berat daripada Responsible, dan keduanya jauh lebih berat daripada sekadar
  // diberi tahu. Urut abjad akan menaruh orang yang cuma di-Inform di atas
  // orang yang menanggung sepuluh aktivitas.
  return hasil.sort(
    (a, b) =>
      b.jumlah.A - a.jumlah.A ||
      b.jumlah.R - a.jumlah.R ||
      b.total - a.total ||
      a.nama.localeCompare(b.nama, "id"),
  );
}

/** Berapa penugasan per peran di seluruh matriks — untuk legenda. */
export function hitungPeran(baris: BarisRaci[]): Record<RaciRole, number> {
  const jumlah = { R: 0, A: 0, C: 0, I: 0 } as Record<RaciRole, number>;
  for (const b of baris) for (const p of RACI_ROLES) jumlah[p] += pecahNama(b.raci[p]).length;
  return jumlah;
}

/* ───────────────────────────── pemeriksaan ─────────────────────────────
 * RACI punya dua aturan yang bukan selera, dan keduanya diam-diam sering
 * dilanggar begitu matriksnya panjang. Menampilkannya sebagai daftar temuan
 * membuat matriks ini bisa DIPERIKSA, bukan cuma dibaca — sama seperti bagan
 * organisasi yang menolak menyimpan lingkaran atasan.                       */

export type BeratTemuan = "salah" | "perhatian";

export interface TemuanRaci {
  pilarSlug: string;
  subSlug: string;
  subLabel: string;
  pilarLabel: string;
  berat: BeratTemuan;
  pesan: string;
}

export function periksaRaci(baris: BarisRaci[]): TemuanRaci[] {
  const temuan: TemuanRaci[] = [];

  for (const b of baris) {
    const dasar = {
      pilarSlug: b.pilarSlug,
      subSlug: b.subSlug,
      subLabel: b.subLabel,
      pilarLabel: b.pilarLabel,
    };
    const a = pecahNama(b.raci.A);
    const r = pecahNama(b.raci.R);

    // Satu penanggung jawab akhir, tidak lebih dan tidak kurang. Dua nama di
    // kolom A terdengar seperti kehati-hatian, tapi akibatnya justru sebaliknya:
    // saat sesuatu tidak beres, keduanya sama-sama menganggap yang lain yang
    // menutup.
    if (a.length === 0) temuan.push({ ...dasar, berat: "salah", pesan: "Belum ada penanggung jawab akhir (A)." });
    else if (a.length > 1) {
      temuan.push({
        ...dasar,
        berat: "salah",
        pesan: `Ada ${a.length} penanggung jawab akhir (A): ${a.join(", ")}. Seharusnya tepat satu.`,
      });
    }

    if (r.length === 0) temuan.push({ ...dasar, berat: "salah", pesan: "Belum ada yang mengerjakan (R)." });

    // Bukan pelanggaran, tapi layak dilihat: satu orang memegang A sekaligus R
    // berarti ia memeriksa pekerjaannya sendiri.
    const rangkap = a.filter((n) => r.includes(n));
    if (rangkap.length > 0 && r.length === 1) {
      temuan.push({
        ...dasar,
        berat: "perhatian",
        pesan: `${rangkap.join(", ")} memegang A sekaligus satu-satunya R — memeriksa pekerjaannya sendiri.`,
      });
    }
  }

  // Yang salah lebih dulu; sisanya urut pilar supaya sejalan dengan matriksnya.
  return temuan.sort(
    (x, y) => (x.berat === y.berat ? 0 : x.berat === "salah" ? -1 : 1) || x.pilarLabel.localeCompare(y.pilarLabel, "id"),
  );
}

/* ───────────────────────────── pencarian ───────────────────────────── */

const normal = (s: string) => s.toLowerCase().trim();

/**
 * Apakah satu baris cocok dengan kata pencarian.
 *
 * Dicari di NAMA ORANG juga, bukan hanya judul aktivitas. Itu yang paling
 * sering dicari orang di matriks seperti ini — "mana saja yang ada Uswatun-nya"
 * — dan pencarian yang hanya melihat judul akan menjawab "tidak ada" untuk
 * pertanyaan yang jawabannya sebelas baris.
 */
export function cocokBaris(b: BarisRaci, kata: string): boolean {
  const q = normal(kata);
  if (!q) return true;
  if (normal(b.subLabel).includes(q)) return true;
  if (normal(b.pilarLabel).includes(q)) return true;
  if (normal(b.fungsi).includes(q)) return true;
  return RACI_ROLES.some((p) => normal(b.raci[p]).includes(q));
}

/** Peran yang dipegang `nama` pada satu baris — kosong berarti tidak terlibat. */
export function peranOrangDiBaris(b: BarisRaci, nama: string): RaciRole[] {
  return RACI_ROLES.filter((p) => pecahNama(b.raci[p]).includes(nama));
}
