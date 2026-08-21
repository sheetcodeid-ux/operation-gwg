/**
 * Tata letak bagan struktur organisasi.
 *
 * Dipisah dari komponennya supaya bisa diuji tanpa merender apa pun. Dua hal
 * di sini yang benar-benar menuntut ketelitian, dan dua-duanya tidak kelihatan
 * sampai terjadi:
 *
 *  • LINGKARAN. Bagan disusun tangan, jadi cepat atau lambat ada yang menaruh
 *    atasan sebuah kotak menjadi bawahannya sendiri. Pohon dengan lingkaran
 *    membuat penelusuran berputar selamanya dan halamannya membeku — bukan
 *    pesan error, membeku.
 *  • YATIM. Kotak yang atasannya menunjuk ke id yang sudah dihapus tidak boleh
 *    ikut hilang dari layar. Ia justru yang paling perlu dilihat supaya bisa
 *    disambungkan lagi.
 */

export interface SimpulBagan {
  id: string;
  nama: string;
  level: number | null;
  parentId: string | null;
  urutan: number | null;
  posX: number | null;
  posY: number | null;
  /** Jumlah orang di departemen ini — dari User Management, tidak diketik. */
  jumlahOrang: number;
  jabatan: string[];
}

export const LEVEL_MIN = 1;
export const LEVEL_MAX = 6;

export const NAMA_LEVEL: Record<number, string> = {
  1: "Direksi",
  2: "Pengawas & Pendamping",
  3: "Kepala Divisi",
  4: "Unit & Spesialis",
  5: "Staf",
  6: "Pelaksana",
};

/**
 * Apakah `calonAtasan` boleh dijadikan atasan `id`.
 *
 * Menolak tiga hal: dirinya sendiri, keturunannya sendiri (itulah yang membuat
 * lingkaran), dan id yang tidak dikenal. Pemeriksaan ini dilakukan SEBELUM
 * disimpan — memperbaiki lingkaran setelah tersimpan jauh lebih sulit karena
 * layar yang seharusnya dipakai memperbaikinya ikut membeku.
 */
export function bolehJadiAtasan(simpul: SimpulBagan[], id: string, calonAtasan: string | null): boolean {
  if (calonAtasan === null) return true;
  if (calonAtasan === id) return false;
  const peta = new Map(simpul.map((s) => [s.id, s]));
  if (!peta.has(calonAtasan) || !peta.has(id)) return false;

  // Telusuri ke ATAS dari calon atasan. Kalau bertemu `id`, berarti calon itu
  // sebenarnya keturunan `id` dan menyambungnya akan membuat lingkaran.
  const dilihat = new Set<string>();
  let kini: string | null = calonAtasan;
  while (kini) {
    if (kini === id) return false;
    if (dilihat.has(kini)) return false; // lingkaran yang sudah ada — jangan tambah
    dilihat.add(kini);
    kini = peta.get(kini)?.parentId ?? null;
  }
  return true;
}

export interface BarisLevel {
  level: number | null;
  nama: string;
  simpul: SimpulBagan[];
}

/** Kelompokkan per level untuk tampilan "Per Level". */
export function perLevel(simpul: SimpulBagan[]): BarisLevel[] {
  const peta = new Map<number | null, SimpulBagan[]>();
  for (const s of simpul) {
    const k = s.level ?? null;
    peta.set(k, [...(peta.get(k) ?? []), s]);
  }
  return [...peta.entries()]
    .map(([level, isi]) => ({
      level,
      nama: level === null ? "Belum diberi level" : `Level ${level} — ${NAMA_LEVEL[level] ?? "Lainnya"}`,
      simpul: [...isi].sort(
        (a, b) => (a.urutan ?? 999) - (b.urutan ?? 999) || a.nama.localeCompare(b.nama, "id"),
      ),
    }))
    .sort((a, b) => (a.level ?? 99) - (b.level ?? 99));
}

export interface SimpulTertata extends SimpulBagan {
  x: number;
  y: number;
  /** Kedalaman dari akar — dipakai mewarnai bila levelnya belum diisi. */
  kedalaman: number;
}

export const LEBAR_KARTU = 208;
export const TINGGI_KARTU = 88;
const JARAK_X = 32;
const JARAK_Y = 72;

/**
 * Tata letak pohon: anak-anak berjajar di bawah induknya, induk berada di
 * TENGAH rentang anak-anaknya.
 *
 * Ditata dari daun ke akar, bukan sebaliknya. Menempatkan induk lebih dulu
 * berarti menebak selebar apa cabang di bawahnya, dan tebakan itu meleset
 * setiap kali cabangnya tidak seimbang — persis keadaan yang paling sering
 * terjadi pada struktur organisasi sungguhan.
 */
export function tataPohon(simpul: SimpulBagan[]): SimpulTertata[] {
  const peta = new Map(simpul.map((s) => [s.id, s]));
  const anak = new Map<string | null, SimpulBagan[]>();
  for (const s of simpul) {
    // Atasan yang tidak dikenal diperlakukan sebagai tanpa atasan, supaya
    // simpul yatim tetap tergambar dan bisa disambungkan lagi.
    const induk = s.parentId && peta.has(s.parentId) ? s.parentId : null;
    anak.set(induk, [...(anak.get(induk) ?? []), s]);
  }
  for (const [k, v] of anak) {
    anak.set(
      k,
      [...v].sort((a, b) => (a.urutan ?? 999) - (b.urutan ?? 999) || a.nama.localeCompare(b.nama, "id")),
    );
  }

  const hasil: SimpulTertata[] = [];
  const dilihat = new Set<string>();
  let kursor = 0;

  const tempatkan = (s: SimpulBagan, kedalaman: number): number => {
    // Penjaga lingkaran: kalau simpul ini sudah pernah ditempatkan di jalur yang
    // sama, berhenti. Tanpa ini penelusuran berputar tanpa akhir.
    if (dilihat.has(s.id)) return kursor;
    dilihat.add(s.id);

    const anaknya = anak.get(s.id) ?? [];
    const y = kedalaman * (TINGGI_KARTU + JARAK_Y);
    let x: number;

    if (anaknya.length === 0) {
      x = kursor;
      kursor += LEBAR_KARTU + JARAK_X;
    } else {
      const posisiAnak = anaknya.map((a) => tempatkan(a, kedalaman + 1));
      const sah = posisiAnak.filter((p) => Number.isFinite(p));
      x = sah.length ? (Math.min(...sah) + Math.max(...sah)) / 2 : kursor;
    }

    hasil.push({ ...s, x: s.posX ?? x, y: s.posY ?? y, kedalaman });
    return x;
  };

  for (const akar of anak.get(null) ?? []) {
    tempatkan(akar, 0);
    kursor += JARAK_X * 2; // jarak antar pohon
  }
  // Simpul yang tidak terjangkau dari akar mana pun — hanya mungkin bila ada
  // lingkaran. Tetap digambar supaya bisa diperbaiki.
  for (const s of simpul) {
    if (!dilihat.has(s.id)) {
      hasil.push({ ...s, x: s.posX ?? kursor, y: s.posY ?? 0, kedalaman: 0 });
      kursor += LEBAR_KARTU + JARAK_X;
    }
  }
  return hasil;
}

/** Garis penghubung induk → anak, dari titik tengah bawah ke tengah atas. */
export interface GarisBagan {
  dari: string;
  ke: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function garisBagan(tertata: SimpulTertata[]): GarisBagan[] {
  const peta = new Map(tertata.map((s) => [s.id, s]));
  const garis: GarisBagan[] = [];
  for (const s of tertata) {
    const induk = s.parentId ? peta.get(s.parentId) : null;
    if (!induk) continue;
    garis.push({
      dari: induk.id,
      ke: s.id,
      x1: induk.x + LEBAR_KARTU / 2,
      y1: induk.y + TINGGI_KARTU,
      x2: s.x + LEBAR_KARTU / 2,
      y2: s.y,
    });
  }
  return garis;
}

/** Ukuran kanvas yang dibutuhkan — dipakai tombol "Muat" (fit). */
export function ukuranKanvas(tertata: SimpulTertata[]): { lebar: number; tinggi: number } {
  if (tertata.length === 0) return { lebar: LEBAR_KARTU, tinggi: TINGGI_KARTU };
  return {
    lebar: Math.max(...tertata.map((s) => s.x)) + LEBAR_KARTU,
    tinggi: Math.max(...tertata.map((s) => s.y)) + TINGGI_KARTU,
  };
}

/** Cocok dengan pencarian: nama departemen atau salah satu jabatan di dalamnya. */
export function cocok(s: SimpulBagan, kata: string): boolean {
  const q = kata.trim().toLowerCase();
  if (!q) return true;
  return s.nama.toLowerCase().includes(q) || s.jabatan.some((j) => j.toLowerCase().includes(q));
}
