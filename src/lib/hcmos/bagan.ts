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
  /** Kedalaman baris di bagan — dipakai untuk animasi bertahap. */
  kedalaman: number;
}

/** Garis penghubung induk → anak. */
export interface GarisBagan {
  dari: string;
  ke: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
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
const SELA_X = 28;
const SELA_Y = 14;
const SELA_TIER = 64;
const INDENT_KOLOM = 16;
/** Ruang cadangan di kanan tiap kolom untuk indentasi keturunannya. */
const RUANG_INDENT = INDENT_KOLOM * 3;

/**
 * Tingkat sebuah simpul di bagan — dari kolom `level`, bukan dari kedalaman
 * pohon.
 *
 * Ini bagian yang sempat saya buat keliru dan akibatnya terlihat langsung.
 * SELURUH sepuluh kepala divisi melapor ke Managing Director, persis seperti
 * Executive Assistant, Internal Audit, dan Legal. Kalau tingkat dihitung dari
 * kedalaman pohon, ketiga belasnya jadi satu tingkat — dan tiap unit di
 * bawahnya naik pangkat jadi kepala kolom sendiri, sehingga bagan melebar ke
 * samping alih-alih menurun.
 *
 * Level yang ditetapkan Human Capital-lah yang tahu bedanya, dan hanya itu.
 */
const tingkat = (s: SimpulBagan, kedalaman: number): number => s.level ?? kedalaman + 1;

/**
 * Tata letak KOLOM.
 *
 *   Level 1  — satu baris mendatar di puncak.
 *   Level 2  — satu baris mendatar di bawahnya.
 *   Level 3  — satu baris mendatar; tiap kepala divisi membuka KOLOMNYA sendiri.
 *   Level 4+ — menumpuk LURUS KE BAWAH di dalam kolom divisinya, berindentasi
 *              sedikit tiap turun satu tingkat.
 *
 * Tiga baris teratas mendatar karena di situ simpulnya sedikit dan hubungannya
 * perlu terlihat sekaligus. Sisanya menurun karena di situlah jumlahnya
 * meledak: tiga puluh unit dan dua belas staf: kalau ikut melebar, bagannya
 * menuntut gulir menyamping puluhan ribu piksel — dan menggulir menyamping jauh
 * lebih melelahkan daripada ke bawah.
 */
export function tataKolom(simpul: SimpulBagan[], terlipat: ReadonlySet<string> = new Set()): SimpulTertata[] {
  const peta = new Map(simpul.map((s) => [s.id, s]));
  const anak = new Map<string | null, SimpulBagan[]>();
  for (const s of simpul) {
    const induk = s.parentId && peta.has(s.parentId) ? s.parentId : null;
    anak.set(induk, [...(anak.get(induk) ?? []), s]);
  }
  const urut = (v: SimpulBagan[]) =>
    [...v].sort((a, b) => (a.urutan ?? 999) - (b.urutan ?? 999) || a.nama.localeCompare(b.nama, "id"));
  for (const [k, v] of anak) anak.set(k, urut(v));

  // Kedalaman dipakai HANYA sebagai cadangan bagi simpul yang levelnya belum
  // diisi — supaya bagan tetap terbentuk sebelum Human Capital menetapkannya.
  const kedalaman = new Map<string, number>();
  {
    const antre: { id: string; d: number }[] = (anak.get(null) ?? []).map((s) => ({ id: s.id, d: 0 }));
    while (antre.length) {
      const { id, d } = antre.pop()!;
      if (kedalaman.has(id)) continue;
      kedalaman.set(id, d);
      for (const a of anak.get(id) ?? []) antre.push({ id: a.id, d: d + 1 });
    }
  }
  const lvl = (s: SimpulBagan) => tingkat(s, kedalaman.get(s.id) ?? 0);

  const hasil: SimpulTertata[] = [];
  const dilihat = new Set<string>();

  const tandaiKeturunan = (id: string) => {
    for (const a of anak.get(id) ?? []) {
      if (dilihat.has(a.id)) continue;
      dilihat.add(a.id);
      tandaiKeturunan(a.id);
    }
  };

  /** Menumpuk satu simpul dan seluruh keturunannya lurus ke bawah. */
  const tumpuk = (s: SimpulBagan, x: number, y: number, dalam: number): number => {
    if (dilihat.has(s.id)) return y;
    dilihat.add(s.id);
    hasil.push({ ...s, x: s.posX ?? x, y: s.posY ?? y, kedalaman: dalam });
    let bawah = y + TINGGI_KOLOM + SELA_Y;
    if (terlipat.has(s.id)) {
      tandaiKeturunan(s.id);
      return bawah;
    }
    for (const a of anak.get(s.id) ?? []) bawah = tumpuk(a, x + INDENT_KOLOM, bawah, dalam + 1);
    return bawah;
  };

  // Kepala kolom: level 3 ke bawah yang induknya berada di atas level 3 — atau
  // tidak punya induk sama sekali.
  const kepalaKolom = urut(
    simpul.filter((s) => {
      if (lvl(s) < 3) return false;
      const induk = s.parentId ? peta.get(s.parentId) : null;
      return !induk || lvl(induk) < 3;
    }),
  );

  const yKolom = 2 * (TINGGI_KOLOM + SELA_TIER);
  const xKolom = new Map<string, number>();
  let x = 0;
  for (const s of kepalaKolom) {
    xKolom.set(s.id, x);
    tumpuk(s, x, yKolom, 2);
    x += LEBAR_KOLOM + RUANG_INDENT + SELA_X;
  }
  const lebarTotal = Math.max(x - SELA_X, LEBAR_KOLOM);

  const barisMendatar = (isi: SimpulBagan[], y: number, dalam: number) => {
    const lebar = isi.length * LEBAR_KOLOM + Math.max(0, isi.length - 1) * SELA_X;
    let kx = (lebarTotal - lebar) / 2;
    for (const s of isi) {
      if (dilihat.has(s.id)) continue;
      dilihat.add(s.id);
      // Simpul yang punya kolom di bawahnya dipusatkan di atas rentang kolom
      // itu; sisanya dijajarkan merata.
      const kolomAnak = (anak.get(s.id) ?? [])
        .map((a) => xKolom.get(a.id))
        .filter((v): v is number => v !== undefined);
      const px = kolomAnak.length ? (Math.min(...kolomAnak) + Math.max(...kolomAnak)) / 2 : kx;
      hasil.push({ ...s, x: s.posX ?? px, y: s.posY ?? y, kedalaman: dalam });
      kx += LEBAR_KOLOM + SELA_X;
    }
  };

  barisMendatar(urut(simpul.filter((s) => lvl(s) === 2)), TINGGI_KOLOM + SELA_TIER, 1);
  barisMendatar(urut(simpul.filter((s) => lvl(s) <= 1)), 0, 0);

  // Simpul tak terjangkau — hanya mungkin bila ada lingkaran. Tetap digambar.
  let xSisa = 0;
  for (const s of simpul) {
    if (dilihat.has(s.id)) continue;
    dilihat.add(s.id);
    hasil.push({ ...s, x: s.posX ?? xSisa, y: s.posY ?? -(TINGGI_KOLOM + SELA_TIER), kedalaman: 0 });
    xSisa += LEBAR_KOLOM + SELA_X;
  }
  return hasil;
}

/**
 * Garis penghubung.
 *
 * Dua bentuk, dan bedanya mengikuti bentuk tata letaknya: antar-baris mendatar
 * ia turun dari tengah bawah induk lalu belok ke tengah atas anak; di dalam
 * kolom ia turun sebagai TULANG di sisi kiri induk lalu menyiku ke tepi kiri
 * anak — bentuk yang sama seperti daftar bertingkat, dan itu memang yang sedang
 * digambarkan.
 */
export function garisKolom(tertata: SimpulTertata[]): GarisBagan[] {
  const peta = new Map(tertata.map((s) => [s.id, s]));
  const garis: GarisBagan[] = [];
  for (const s of tertata) {
    const induk = s.parentId ? peta.get(s.parentId) : null;
    if (!induk) continue;
    const menumpuk = s.x > induk.x && s.y > induk.y + TINGGI_KOLOM / 2;
    garis.push(
      menumpuk
        ? {
            dari: induk.id,
            ke: s.id,
            x1: induk.x + INDENT_KOLOM / 2,
            y1: induk.y + TINGGI_KOLOM,
            x2: s.x,
            y2: s.y + TINGGI_KOLOM / 2,
          }
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

/** Ukuran kanvas yang dibutuhkan — dipakai tombol "Fit". */
export function ukuranKanvas(tertata: SimpulTertata[]): { lebar: number; tinggi: number } {
  if (tertata.length === 0) return { lebar: LEBAR_KOLOM, tinggi: TINGGI_KOLOM };
  return {
    lebar: Math.max(...tertata.map((s) => s.x)) + LEBAR_KOLOM,
    tinggi: Math.max(...tertata.map((s) => s.y)) + TINGGI_KOLOM,
  };
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
