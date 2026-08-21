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
  /** Keterangan singkat di kartu. Kosong berarti barisnya tidak digambar. */
  deskripsi?: string | null;
  /**
   * Orang yang benar-benar menempati role ini — dari User Management.
   *
   * Dibawa serta, bukan cuma jumlahnya, karena pertanyaan yang menyusul angka
   * itu selalu sama: "siapa saja". Menyimpan angkanya saja memaksa orang
   * berpindah ke layar lain untuk pertanyaan yang seharusnya dijawab di tempat.
   */
  orang?: { nama: string; jabatan: string }[];
}

/**
 * Inisial untuk lencana kartu — huruf pertama dari dua kata pertama.
 *
 * Diturunkan dari namanya, tidak disimpan: satu kolom lagi yang harus diisi
 * tangan berarti satu kolom lagi yang lupa diperbarui saat departemennya ganti
 * nama, dan lencana yang tidak cocok dengan judul di sebelahnya lebih
 * membingungkan daripada tidak ada lencana sama sekali.
 */
export function inisialDari(nama: string): string {
  const kata = nama.trim().split(/\s+/).filter(Boolean);
  if (kata.length === 0) return "?";
  if (kata.length === 1) return kata[0][0].toUpperCase();
  return (kata[0][0] + kata[1][0]).toUpperCase();
}

/** Jumlah seluruh keturunan, bukan cuma anak langsung. */
export function jumlahKeturunan(simpul: SimpulBagan[], id: string): number {
  const anak = new Map<string, string[]>();
  for (const s of simpul) {
    if (!s.parentId) continue;
    anak.set(s.parentId, [...(anak.get(s.parentId) ?? []), s.id]);
  }
  let n = 0;
  const dilihat = new Set<string>();
  const antre = [...(anak.get(id) ?? [])];
  while (antre.length) {
    const k = antre.pop()!;
    if (dilihat.has(k)) continue; // penjaga lingkaran
    dilihat.add(k);
    n += 1;
    antre.push(...(anak.get(k) ?? []));
  }
  return n;
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


/* ───────────────────────────── tata letak kolom ───────────────────────────── */

export const LEBAR_KOLOM = 176;
export const TINGGI_KOLOM = 78;
const SELA_X = 24;
const SELA_Y = 12;
const SELA_TIER = 56;

/**
 * Tata letak KOLOM — bentuk yang dipakai bagan organisasi sungguhan.
 *
 * Pohon simetris (induk tepat di tengah anak-anaknya) terlihat rapi pada contoh
 * kecil, tapi pada struktur nyata dengan sepuluh divisi dan enam puluh posisi
 * ia melebar sampai puluhan ribu piksel: setiap daun menuntut lebarnya sendiri,
 * dan lebar itu menjalar ke atas. Yang tersisa cuma pita tipis di tengah layar
 * dengan ruang kosong menganga di kiri-kanannya.
 *
 * Bentuk kolom membalik itu. Dua tingkat teratas tetap mendatar — di situ
 * memang sedikit simpulnya dan hubungannya perlu terlihat sekaligus. Mulai
 * tingkat ketiga, tiap kepala divisi memulai KOLOMNYA SENDIRI dan seluruh
 * keturunannya ditumpuk lurus ke bawah. Tingginya tumbuh dengan jumlah orang,
 * bukan lebarnya — dan layar memang bisa digulir ke bawah jauh lebih nyaman
 * daripada ke samping.
 */
export function tataKolom(simpul: SimpulBagan[], terlipat: ReadonlySet<string> = new Set()): SimpulTertata[] {
  const peta = new Map(simpul.map((s) => [s.id, s]));
  const anak = new Map<string | null, SimpulBagan[]>();
  for (const s of simpul) {
    const induk = s.parentId && peta.has(s.parentId) ? s.parentId : null;
    anak.set(induk, [...(anak.get(induk) ?? []), s]);
  }
  for (const [k, v] of anak) {
    anak.set(k, [...v].sort((a, b) => (a.urutan ?? 999) - (b.urutan ?? 999) || a.nama.localeCompare(b.nama, "id")));
  }

  const hasil: SimpulTertata[] = [];
  const dilihat = new Set<string>();
  const akar = anak.get(null) ?? [];

  // Tingkat 0 dan 1: mendatar, dipusatkan belakangan setelah lebar totalnya
  // diketahui. Tingkat 2 ke bawah: satu kolom per simpul tingkat 2.
  const tier1 = akar.flatMap((a) => anak.get(a.id) ?? []);
  const tier2 = tier1.flatMap((a) => anak.get(a.id) ?? []);

  const kolomDari = (s: SimpulBagan, x: number, y: number, kedalaman: number): number => {
    if (dilihat.has(s.id)) return y;
    dilihat.add(s.id);
    hasil.push({ ...s, x: s.posX ?? x, y: s.posY ?? y, kedalaman });
    let bawah = y + TINGGI_KOLOM + SELA_Y;
    if (terlipat.has(s.id)) {
      // Keturunannya ikut ditandai sudah-dilihat meski tidak digambar.
      // Tanpa itu, jaring "tak terjangkau" di bawah menganggapnya simpul yatim
      // lalu menggambarnya kembali di luar bagan — melipat sebuah cabang justru
      // memuntahkan isinya ke tempat yang lebih mencolok.
      tandaiKeturunan(s.id);
      return bawah;
    }
    for (const a of anak.get(s.id) ?? []) bawah = kolomDari(a, x, bawah, kedalaman + 1);
    return bawah;
  };

  function tandaiKeturunan(id: string) {
    for (const a of anak.get(id) ?? []) {
      if (dilihat.has(a.id)) continue;
      dilihat.add(a.id);
      tandaiKeturunan(a.id);
    }
  }

  // Kolom-kolomnya dulu, supaya lebar totalnya diketahui sebelum dua tingkat
  // teratas dipusatkan terhadapnya.
  const yKolom = 2 * (TINGGI_KOLOM + SELA_TIER);
  let x = 0;
  const xKolom = new Map<string, number>();
  for (const s of tier2) {
    xKolom.set(s.id, x);
    kolomDari(s, x, yKolom, 2);
    x += LEBAR_KOLOM + SELA_X;
  }
  const lebarTotal = Math.max(x - SELA_X, LEBAR_KOLOM);

  // Tingkat 1 dipusatkan di atas rentang kolom anak-anaknya; yang tidak punya
  // kolom dijajarkan merata.
  const lebarTier1 = tier1.length * LEBAR_KOLOM + (tier1.length - 1) * SELA_X;
  let xTier1 = (lebarTotal - lebarTier1) / 2;
  for (const s of tier1) {
    const anaknya = (anak.get(s.id) ?? []).map((a) => xKolom.get(a.id)).filter((v): v is number => v !== undefined);
    const px = anaknya.length ? (Math.min(...anaknya) + Math.max(...anaknya)) / 2 : xTier1;
    dilihat.add(s.id);
    hasil.push({ ...s, x: s.posX ?? px, y: s.posY ?? TINGGI_KOLOM + SELA_TIER, kedalaman: 1 });
    xTier1 += LEBAR_KOLOM + SELA_X;
  }

  for (const s of akar) {
    dilihat.add(s.id);
    hasil.push({ ...s, x: s.posX ?? (lebarTotal - LEBAR_KOLOM) / 2, y: s.posY ?? 0, kedalaman: 0 });
  }

  // Simpul yang tak terjangkau — hanya mungkin bila ada lingkaran. Tetap
  // digambar supaya bisa diperbaiki.
  let xSisa = 0;
  for (const s of simpul) {
    if (dilihat.has(s.id)) continue;
    hasil.push({ ...s, x: s.posX ?? xSisa, y: s.posY ?? -(TINGGI_KOLOM + SELA_TIER), kedalaman: 0 });
    xSisa += LEBAR_KOLOM + SELA_X;
  }
  return hasil;
}

/** Garis siku — dua tingkat teratas turun tegak, kolom menyamping dari kiri. */
export function garisKolom(tertata: SimpulTertata[]): GarisBagan[] {
  const peta = new Map(tertata.map((s) => [s.id, s]));
  const garis: GarisBagan[] = [];
  for (const s of tertata) {
    const induk = s.parentId ? peta.get(s.parentId) : null;
    if (!induk) continue;
    const menumpuk = Math.abs(induk.x - s.x) < 1;
    garis.push(
      menumpuk
        ? { dari: induk.id, ke: s.id, x1: induk.x + 16, y1: induk.y + TINGGI_KOLOM, x2: s.x + 16, y2: s.y }
        : {
            dari: induk.id,
            ke: s.id,
            x1: induk.x + LEBAR_KOLOM / 2,
            y1: induk.y + TINGGI_KOLOM,
            x2: s.x + LEBAR_KOLOM / 2,
            y2: s.y,
          },
    );
  }
  return garis;
}


/* ──────────────────────────── silsilah & sorotan ──────────────────────────── */

/** Rantai atasan dari sebuah simpul sampai puncak, terdekat lebih dulu. */
export function rantaiKeAtas(simpul: SimpulBagan[], id: string): SimpulBagan[] {
  const peta = new Map(simpul.map((s) => [s.id, s]));
  const hasil: SimpulBagan[] = [];
  const dilihat = new Set<string>([id]);
  let kini = peta.get(id)?.parentId ?? null;
  while (kini && !dilihat.has(kini)) {
    dilihat.add(kini);
    const s = peta.get(kini);
    if (!s) break;
    hasil.push(s);
    kini = s.parentId;
  }
  return hasil;
}

/**
 * Silsilah sebuah simpul: dirinya, seluruh atasannya ke atas, dan seluruh
 * bawahannya ke bawah.
 *
 * Inilah yang sebenarnya ditanyakan orang saat menunjuk satu kotak di bagan
 * enam puluh kotak — bukan "kotak ini apa", melainkan "kotak ini bagian dari
 * jalur yang mana". Menyorot jalurnya dan meredupkan sisanya menjawab itu
 * seketika; tanpa itu, matanya harus menyusuri garis satu per satu.
 */
export function silsilah(simpul: SimpulBagan[], id: string): Set<string> {
  const hasil = new Set<string>([id]);
  for (const s of rantaiKeAtas(simpul, id)) hasil.add(s.id);

  const anak = new Map<string, string[]>();
  for (const s of simpul) {
    if (!s.parentId) continue;
    anak.set(s.parentId, [...(anak.get(s.parentId) ?? []), s.id]);
  }
  const antre = [...(anak.get(id) ?? [])];
  while (antre.length) {
    const k = antre.pop()!;
    if (hasil.has(k)) continue; // penjaga lingkaran
    hasil.add(k);
    antre.push(...(anak.get(k) ?? []));
  }
  return hasil;
}

/** Seluruh simpul yang punya bawahan — dipakai tombol "lipat semua". */
export const simpulBercabang = (simpul: SimpulBagan[]): string[] => [
  ...new Set(simpul.map((s) => s.parentId).filter((v): v is string => !!v)),
];


/* ─────────────────────────────── magnet ─────────────────────────────── */

export const KISI = 8;
const TOLERANSI = 7;

export interface HasilMagnet {
  x: number;
  y: number;
  /** Sumbu x yang sedang disejajarkan — untuk menggambar garis bantu. */
  panduX: number | null;
  panduY: number | null;
}

/**
 * Menempelkan kartu yang sedang digeser ke kartu lain — "magnet".
 *
 * Dua tahap, dan urutannya penting. Pertama dicari kartu lain yang tepinya
 * hampir sejajar; kalau ada, kartunya ditempelkan PERSIS ke sana dan sumbunya
 * dikembalikan supaya bisa digambar sebagai garis bantu. Kalau tidak ada, baru
 * dibulatkan ke kisi.
 *
 * Kebalikannya — kisi dulu, baru sejajar — terasa patah: kartunya melompat ke
 * kisi lebih dulu, jadi tepi yang sudah hampir lurus malah dijauhkan sebelum
 * sempat menempel.
 */
export function magnet(
  x: number,
  y: number,
  lain: { x: number; y: number }[],
  toleransi = TOLERANSI,
): HasilMagnet {
  let hx = x;
  let hy = y;
  let panduX: number | null = null;
  let panduY: number | null = null;

  let terdekatX = toleransi + 1;
  let terdekatY = toleransi + 1;
  for (const l of lain) {
    const dx = Math.abs(l.x - x);
    if (dx <= toleransi && dx < terdekatX) {
      terdekatX = dx;
      hx = l.x;
      panduX = l.x;
    }
    const dy = Math.abs(l.y - y);
    if (dy <= toleransi && dy < terdekatY) {
      terdekatY = dy;
      hy = l.y;
      panduY = l.y;
    }
  }

  if (panduX === null) hx = Math.round(x / KISI) * KISI;
  if (panduY === null) hy = Math.round(y / KISI) * KISI;
  return { x: hx, y: hy, panduX, panduY };
}
