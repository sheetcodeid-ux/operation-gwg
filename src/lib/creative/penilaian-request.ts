/**
 * Penilaian terhadap YANG MEMINTA design, bukan terhadap yang mengerjakannya.
 *
 * MASALAH YANG DIJAWABNYA. Tim Creative kewalahan karena permintaan datang
 * mendadak — sering H-1 — lalu menumpuk, dan ketika hasilnya terlambat yang
 * tertuduh adalah tim design. Selama tidak ada catatan, perdebatannya adu
 * ingatan: "kami minta jauh-jauh hari" lawan "tidak, itu mendadak". Yang
 * dibutuhkan bukan siapa yang lebih keras bicara, melainkan angka yang sudah
 * ada sejak permintaannya dikirim.
 *
 * MENGAPA SEBAGIAN BESARNYA DIHITUNG, BUKAN DINILAI.
 *
 * Permintaan Fikri jelas: "nilai bukan karena subjective". Maka 60 dari 100
 * poin datang dari SATU angka yang tidak bisa diperdebatkan siapa pun —
 * selisih hari antara permintaan dikirim dan tanggal dibutuhkannya. Keduanya
 * sudah tercatat otomatis sejak dulu; tidak ada yang perlu diisi, tidak ada
 * yang bisa dikarang belakangan, dan tidak ada bedanya siapa yang membuka
 * layarnya.
 *
 * 40 poin sisanya memang diisi manusia — tapi bentuknya CEKLIS FAKTA, bukan
 * penilaian rasa. Pertanyaannya "apakah ukurannya disebut", bukan "seberapa
 * bagus briefnya". Sesuatu yang bisa dibuktikan dengan membuka permintaannya
 * kembali, dan karena itu bisa dibantah dengan bukti — bukan dengan pendapat.
 *
 * Yang menilai hanya satu orang, yang meng-ACC hasil akhir design. Bukan
 * karena pendapatnya lebih benar, melainkan karena ia satu-satunya yang
 * melihat SELURUH permintaan; penilai yang berbeda-beda akan membuat angka
 * antar-outlet tidak bisa dibandingkan sama sekali.
 */

/** Ambang hari yang membedakan "terencana" dari "mendadak". */
export const HARI_MENDADAK = 1;
export const HARI_MEPET = 3;
export const HARI_WAJAR = 7;

/** Bobot: waktu jauh lebih berat daripada ceklis, dan itu disengaja. */
export const BOBOT_WAKTU = 60;
export const BOBOT_BRIEF = 40;

export type KategoriWaktu = "wajar" | "cukup" | "mepet" | "mendadak" | "tanpa_tanggal";

export const WAKTU_META: Record<KategoriWaktu, { label: string; poin: number; tone: "success" | "brand" | "warning" | "danger" | "neutral" }> = {
  wajar: { label: `≥ ${HARI_WAJAR} hari`, poin: 60, tone: "success" },
  cukup: { label: "4–6 hari", poin: 45, tone: "brand" },
  mepet: { label: "2–3 hari", poin: 25, tone: "warning" },
  mendadak: { label: "H-1 atau hari-H", poin: 0, tone: "danger" },
  tanpa_tanggal: { label: "Tanpa tanggal dibutuhkan", poin: 0, tone: "neutral" },
};

/**
 * Selisih hari antara permintaan dikirim dan tanggal dibutuhkannya.
 *
 * Dibulatkan ke bawah pada batas hari kalender, bukan selisih jam: permintaan
 * yang masuk pukul 23.00 untuk besok pagi tetap H-1, bukan "0,4 hari".
 */
export function selisihHari(dibuat: string, deadline: string | null): number | null {
  if (!deadline) return null;
  const a = new Date(`${dibuat.slice(0, 10)}T00:00:00Z`).getTime();
  const b = new Date(`${deadline.slice(0, 10)}T00:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Kategori waktu satu permintaan.
 *
 * Deadline yang SUDAH LEWAT saat diminta ikut terhitung mendadak — bukan
 * kesalahan hitung, memang ada permintaan yang dikirim pada hari acaranya.
 */
export function kategoriWaktu(hari: number | null): KategoriWaktu {
  if (hari === null) return "tanpa_tanggal";
  if (hari <= HARI_MENDADAK) return "mendadak";
  if (hari <= HARI_MEPET) return "mepet";
  if (hari < HARI_WAJAR) return "cukup";
  return "wajar";
}

/**
 * Ceklis kelengkapan brief — empat fakta yang bisa dibuktikan dengan membuka
 * permintaannya kembali, bukan empat pendapat.
 */
export interface CeklisBrief {
  /** Untuk apa desainnya dan pesan apa yang harus tersampaikan. */
  tujuanJelas: boolean;
  /** Ukuran dan medianya disebut (feed, story, banner 3×1 m, dan seterusnya). */
  ukuranMedia: boolean;
  /** Materi pendukungnya disertakan: foto, logo, teks yang harus dipakai. */
  materiLengkap: boolean;
  /** Kapan desainnya harus tayang — bukan sekadar "secepatnya". */
  tanggalTayang: boolean;
}

export const BUTIR_BRIEF: { key: keyof CeklisBrief; label: string; bantu: string }[] = [
  {
    key: "tujuanJelas",
    label: "Tujuan & pesan jelas",
    bantu: "Untuk apa desainnya dan pesan apa yang harus sampai — bukan sekadar “buatkan poster”.",
  },
  {
    key: "ukuranMedia",
    label: "Ukuran & media disebut",
    bantu: "Feed, story, banner 3×1 m, dan seterusnya. Tanpa ini desainnya hampir pasti diulang.",
  },
  {
    key: "materiLengkap",
    label: "Materi pendukung disertakan",
    bantu: "Foto, logo, dan teks yang harus dipakai sudah dilampirkan sejak awal.",
  },
  {
    key: "tanggalTayang",
    label: "Tanggal tayang jelas",
    bantu: "Kapan desainnya dipakai. “Secepatnya” bukan tanggal.",
  },
];

export const CEKLIS_KOSONG: CeklisBrief = {
  tujuanJelas: false,
  ukuranMedia: false,
  materiLengkap: false,
  tanggalTayang: false,
};

export const poinBrief = (c: CeklisBrief): number =>
  BUTIR_BRIEF.filter((b) => c[b.key]).length * (BOBOT_BRIEF / BUTIR_BRIEF.length);

export type Label = "hijau" | "kuning" | "merah";

export const LABEL_META: Record<Label, { label: string; tone: "success" | "warning" | "danger"; arti: string }> = {
  hijau: { label: "Hijau", tone: "success", arti: "Permintaannya terencana dan briefnya lengkap." },
  kuning: { label: "Kuning", tone: "warning", arti: "Masih bisa dikerjakan, tapi waktunya mepet atau briefnya kurang." },
  merah: { label: "Merah", tone: "danger", arti: "Mendadak dan/atau briefnya tidak lengkap — inilah yang membuat antrian menumpuk." },
};

export const AMBANG_HIJAU = 75;
export const AMBANG_KUNING = 50;

export function labelDari(skor: number): Label {
  if (skor >= AMBANG_HIJAU) return "hijau";
  if (skor >= AMBANG_KUNING) return "kuning";
  return "merah";
}

export interface HasilPenilaian {
  hari: number | null;
  waktu: KategoriWaktu;
  poinWaktu: number;
  poinBrief: number;
  skor: number;
  label: Label;
}

/** Skor satu permintaan: waktu (dihitung) + ceklis brief (fakta yang dicentang). */
export function nilaiPermintaan(dibuat: string, deadline: string | null, ceklis: CeklisBrief): HasilPenilaian {
  const hari = selisihHari(dibuat, deadline);
  const waktu = kategoriWaktu(hari);
  const pw = WAKTU_META[waktu].poin;
  const pb = poinBrief(ceklis);
  const skor = Math.round(pw + pb);
  return { hari, waktu, poinWaktu: pw, poinBrief: pb, skor, label: labelDari(skor) };
}


/* ──────────────────────────── periode (bulan) ──────────────────────────── */

export const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
] as const;

/** Penanda "seluruh bulan" pada saringan periode. */
export const SEMUA_PERIODE = "";

/** "2026-08-22T…" → "2026-08". Dipotong, bukan diurai lewat `Date`, supaya
 *  bulannya tidak bergeser mengikuti zona waktu peramban yang membukanya. */
export const periodeDari = (iso: string): string => iso.slice(0, 7);

/** "2026-08" → "Agustus 2026". */
export function labelPeriode(periode: string): string {
  const [th, bl] = periode.split("-");
  const i = Number(bl) - 1;
  if (!th || i < 0 || i > 11) return periode;
  return `${NAMA_BULAN[i]} ${th}`;
}

/**
 * Daftar bulan yang BENAR-BENAR punya permintaan, terbaru dulu.
 *
 * Bukan dua belas bulan mati: memilih bulan yang isinya pasti kosong hanya
 * membuat orang mengira dashboard-nya rusak.
 */
export function daftarPeriode(rows: { periode: string }[]): { value: string; label: string }[] {
  const set = new Set(rows.map((r) => r.periode).filter(Boolean));
  return [...set].sort((a, b) => b.localeCompare(a)).map((p) => ({ value: p, label: labelPeriode(p) }));
}

/* ─────────────────────────── area / wilayah ─────────────────────────── */

/**
 * Permintaan yang tidak berasal dari cabang mana pun.
 *
 * Bukan "tanpa area": permintaan dari Operation, Marketing, atau Human Capital
 * memang tidak punya cabang, dan menamainya "tanpa outlet" membuat Coordinator
 * Area mencari-cari cabang yang tidak pernah ada.
 */
export const HEAD_OFFICE = "__head_office";
export const HEAD_OFFICE_LABEL = "Head Office";

/* ─────────────────────────── rekap per pemohon ─────────────────────────── */

export interface BarisNilai {
  /** Siapa yang meminta. */
  pemohonId: string;
  pemohonNama: string;
  /** Area tempat permintaannya berasal — cabang pemohon, atau Head Office. */
  areaId: string;
  areaNama: string;
  /** Cabangnya, kalau ada. Dipakai sebagai keterangan, bukan pengelompokan. */
  outletNama: string | null;
  /** "2026-08" — bulan permintaannya dikirim. */
  periode: string;
  skor: number;
  hari: number | null;
  waktu: KategoriWaktu;
}

export interface RekapPemohon {
  id: string;
  nama: string;
  areaId: string;
  areaNama: string;
  outletNama: string | null;
  jumlah: number;
  rataSkor: number;
  label: Label;
  mendadak: number;
  persenMendadak: number;
  /** Rata-rata hari tenggang — angka yang paling sering jadi bahan perdebatan. */
  rataHari: number | null;
}

/** Saring baris ke satu bulan. Periode kosong berarti seluruh bulan. */
export function dalamPeriode<T extends { periode: string }>(rows: T[], periode: string): T[] {
  return periode ? rows.filter((r) => r.periode === periode) : rows;
}

const bulatSatu = (n: number) => Math.round(n * 10) / 10;

function ringkas(list: BarisNilai[]) {
  const rata = Math.round(list.reduce((a, r) => a + r.skor, 0) / list.length);
  const mendadak = list.filter((r) => r.waktu === "mendadak").length;
  const berhari = list.filter((r) => r.hari !== null).map((r) => r.hari!);
  return {
    jumlah: list.length,
    rataSkor: rata,
    label: labelDari(rata),
    mendadak,
    persenMendadak: Math.round((mendadak / list.length) * 100),
    rataHari: berhari.length ? bulatSatu(berhari.reduce((a, b) => a + b, 0) / berhari.length) : null,
  };
}

/**
 * Rekap per pemohon — satu-satunya tabel rekap yang ada.
 *
 * Dulu ada dua: per outlet dan per pemohon. Keduanya menjawab pertanyaan yang
 * sama dua kali, dan yang per outlet tidak pernah bisa menjawabnya untuk
 * permintaan kantor. Sekarang areanya jadi KOLOM, bukan tabel terpisah: satu
 * baris per orang, dengan wilayahnya tertulis di sebelah namanya.
 *
 * LABELNYA DIHITUNG DARI RATA-RATA SKOR, bukan dari permintaan terakhir. Satu
 * permintaan mendadak tidak membuat seseorang merah selamanya, dan satu
 * permintaan rapi tidak menghapus sepuluh yang mendadak sebelumnya.
 *
 * Yang belum punya satu pun permintaan dinilai TIDAK dimunculkan sama sekali —
 * label hijau untuk orang yang belum pernah meminta apa pun adalah pujian yang
 * tidak ia kerjakan, dan label merah lebih buruk lagi.
 */
export function rekapPemohon(rows: BarisNilai[]): RekapPemohon[] {
  const peta = new Map<string, BarisNilai[]>();
  for (const r of rows) peta.set(r.pemohonId, [...(peta.get(r.pemohonId) ?? []), r]);

  return [...peta.entries()]
    .map(([id, list]) => ({
      id,
      nama: list[0].pemohonNama,
      // Barisnya datang terbaru dulu, jadi yang dipakai area TERAKHIR-nya.
      // Supervisor yang pindah cabang tidak boleh terus tercatat di area lama.
      areaId: list[0].areaId,
      areaNama: list[0].areaNama,
      outletNama: list[0].outletNama,
      ...ringkas(list),
    }))
    .sort((a, b) => a.rataSkor - b.rataSkor || b.jumlah - a.jumlah);
}

export interface RekapArea {
  areaId: string;
  areaNama: string;
  jumlah: number;
  rataSkor: number;
  label: Label;
  mendadak: number;
  persenMendadak: number;
  rataHari: number | null;
  orang: RekapPemohon[];
}

/**
 * Rekap per area — dipakai laporan yang dikirim ke Coordinator Area.
 *
 * Bukan tampilan tersendiri di layar: yang dibaca CA adalah daftar orang di
 * wilayahnya, dan angka areanya cuma kepala suratnya.
 */
export function rekapArea(rows: BarisNilai[]): RekapArea[] {
  const peta = new Map<string, BarisNilai[]>();
  for (const r of rows) peta.set(r.areaId, [...(peta.get(r.areaId) ?? []), r]);

  return [...peta.entries()]
    .map(([areaId, list]) => ({
      areaId,
      areaNama: list[0].areaNama,
      ...ringkas(list),
      orang: rekapPemohon(list),
    }))
    .sort((a, b) => a.rataSkor - b.rataSkor || b.jumlah - a.jumlah);
}
