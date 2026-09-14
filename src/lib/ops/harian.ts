/**
 * Penjualan HARI DEMI HARI dalam satu bulan, per outlet.
 *
 * Angka bulanan menjawab "berapa", angka harian menjawab "kapan". Outlet yang
 * turun 20% sebulan bisa berarti dua hal yang sama sekali berbeda: turun
 * sedikit tiap hari, atau tutup empat hari. Keduanya terbaca sama di laporan
 * bulanan, dan yang harus dikerjakan Coordinator Area berbeda jauh.
 *
 * Berkas ini hanya BERHITUNG — tidak menyentuh basis data dan tidak tahu siapa
 * yang membacanya, supaya seluruh aturannya bisa diuji tanpa ESB.
 */

/** Satu hari dalam bulan itu. */
export interface HariKolom {
  /** Tanggal 1–31. */
  tanggal: number;
  /** Nama hari pendek: SEN, SEL, RAB, KAM, JUM, SAB, MIN. */
  hari: string;
  /** Sabtu atau Minggu — ditandai supaya pola akhir pekan terbaca. */
  pekan: boolean;
}

const NAMA_HARI = ["MIN", "SEN", "SEL", "RAB", "KAM", "JUM", "SAB"] as const;

/** Jumlah hari dalam sebuah bulan "YYYY-MM". */
export function jumlahHari(periode: string): number {
  const [th, bl] = periode.split("-").map(Number);
  return new Date(Date.UTC(th, bl, 0)).getUTCDate();
}

/** Kolom hari sebuah bulan, urut tanggal 1 sampai akhir. */
export function kolomHari(periode: string): HariKolom[] {
  const [th, bl] = periode.split("-").map(Number);
  return Array.from({ length: jumlahHari(periode) }, (_, i) => {
    const d = new Date(Date.UTC(th, bl - 1, i + 1));
    const w = d.getUTCDay();
    return { tanggal: i + 1, hari: NAMA_HARI[w], pekan: w === 0 || w === 6 };
  });
}

export interface SumberHarian {
  outletId: string;
  nama: string;
  /** Keterangan di bawah namanya — siapa yang memegang outlet ini. */
  area: string;
  /**
   * Target SEBULAN outlet ini — rata-rata tiga bulan + pertumbuhan.
   *
   * Angka yang sama dengan target KPI Coordinator Area, bukan hitungan
   * tersendiri: satu outlet tidak boleh terbaca tercapai di halaman ini dan
   * gagal di rapornya sendiri. Null = belum genap tiga bulan, jadi memang
   * belum punya target.
   */
  targetBulan?: number | null;
  /** Penjualan tiap tanggal; null = belum ditarik dari ESB. */
  hari: (number | null)[];
  /** Penjualan tiap tanggal BULAN LALU — pembanding yang setara. */
  hariLalu: (number | null)[];
  /**
   * Penjualan HARI TERAKHIR bulan lalu.
   *
   * Dipakai satu-satunya tempat yang tidak punya "hari sebelumnya": tanggal 1.
   * Tanpa ini kolom pertama selalu kosong persentasenya, padahal justru
   * pergantian bulan yang paling sering ditanyakan — apakah awal bulan ini
   * mulai lebih baik daripada akhir bulan lalu.
   */
  akhirBulanLalu?: number | null;
  /**
   * Berapa hari bulan ini yang SUDAH LEWAT — penentu sisa hari mengejar.
   *
   * Bulan yang sudah selesai mengisinya dengan jumlah hari bulan itu; bulan
   * berjalan mengisinya dengan tanggal hari ini. Kosong berarti tidak
   * diketahui, dan sisa harinya jatuh kembali ke cara lama.
   */
  hariBerjalan?: number | null;
}

export interface BarisHarian extends SumberHarian {
  /** Jumlah seluruh hari yang sudah ada angkanya. */
  bulanIni: number | null;
  /**
   * Jumlah bulan lalu PADA TANGGAL-TANGGAL YANG SAMA PERSIS.
   *
   * Bukan bulan lalu penuh: tanggal 14 dibandingkan dengan sebulan penuh selalu
   * menghasilkan minus delapan puluh persen, untuk SETIAP outlet, setiap bulan
   * — angka yang tidak pernah salah dan tidak pernah berguna.
   *
   * Dan bukan pula "tanggal 1 sampai tanggal terakhir yang terisi": kalau bulan
   * ini berlubang di tengah, itu menjumlah hari bulan lalu yang tidak ada
   * lawannya. Yang dijumlah hanya tanggal yang bulan ini punya angkanya.
   */
  bulanLalu: number | null;
  /** Perubahan terhadap `bulanLalu`, dalam persen. */
  mom: number | null;
  /** Perubahan tiap hari terhadap HARI SEBELUMNYA, dalam persen. */
  ubah: (number | null)[];

  /* ───────────────────────── pencapaian target ───────────────────────── */

  /**
   * Target SEHARI — target sebulan dibagi rata jumlah hari bulan itu.
   *
   * Dibagi rata, bukan ditimbang akhir pekan. Pembobotan menuntut pola yang
   * berbeda-beda tiap outlet dan tiap brand; yang dibagi rata bisa diperiksa
   * siapa pun dengan kalkulator, dan itu lebih berguna daripada rumus yang
   * lebih tepat tapi tidak bisa ditelusuri.
   */
  targetHarian: number | null;
  /** Capaian tiap hari terhadap target harian, dalam persen. */
  capaian: (number | null)[];
  /**
   * Capaian SEBULAN terhadap targetnya, dalam persen.
   *
   * Dipakai bar di kolom Bulan Ini. Bukan rata-rata capaian harian: hari yang
   * belum ditarik akan menyeret rata-rata itu turun, sementara yang sedang
   * ditanyakan justru "dari target sebulan, sudah sejauh mana".
   */
  capaianBulan: number | null;
  /** Berapa hari yang sudah ada angkanya MENCAPAI target harian. */
  hariTercapai: number;
  /** Berapa hari yang sudah ada angkanya sama sekali. */
  hariTerisi: number;
  /**
   * BERAPA HARI YANG SUDAH LEWAT TAPI ANGKANYA BELUM ADA.
   *
   * Angka paling penting di baris ini, dan satu-satunya yang bercerita tentang
   * angka-angka lain di sebelahnya. Hari yang belum ditarik ikut dihitung nol
   * ke dalam "Bulan Ini" dan "Kurang" — jadi selama lubangnya ada, outlet itu
   * TERBACA LEBIH BURUK daripada keadaannya. Tanpa angka ini di layar, yang
   * membaca tidak punya cara membedakan outlet yang benar-benar turun dari
   * outlet yang datanya belum sampai.
   *
   * Nol berarti seluruh hari yang sudah lewat sudah ada angkanya.
   */
  lubang: number;
  /**
   * DERET HARI TERCAPAI YANG MASIH BERJALAN — dihitung mundur dari hari
   * terakhir yang ada angkanya.
   *
   * Berbeda dari `hariTercapai`, dan bedanya penting. Sepuluh hari tercapai
   * yang tersebar sepanjang bulan menggambarkan outlet yang naik-turun; lima
   * hari tercapai berturut-turut sampai kemarin menggambarkan outlet yang
   * sedang jalan. Yang pertama sudah terbaca dari jumlahnya; yang kedua tidak
   * terbaca dari mana pun sebelum ini.
   */
  deret: number;
  /**
   * Target sebulan dikurangi capaian sampai hari ini.
   *
   * Positif berarti masih kurang sekian; nol atau minus berarti targetnya sudah
   * terlampaui. Inilah angka yang dicari orang di ujung tabel: bukan "sudah
   * berapa", melainkan "kurang berapa lagi".
   */
  kurang: number | null;
  /** Berapa per hari yang harus dikejar di sisa hari bulan itu. */
  perHariSisa: number | null;
  /** Sisa hari yang masih bisa dipakai mengejar. */
  sisaHari: number;
}

/** Perubahan b terhadap a dalam persen; null bila salah satunya tidak ada. */
export function bandingHarian(a: number | null, b: number | null): number | null {
  if (a === null || b === null || a <= 0) return null;
  return ((b - a) / a) * 100;
}

const jumlahAda = (v: (number | null)[]): number | null => {
  const ada = v.filter((n): n is number => n !== null);
  return ada.length ? ada.reduce((x, y) => x + y, 0) : null;
};

/**
 * Satu baris tabel harian.
 *
 * Hari yang BELUM DITARIK dibiarkan null, tidak dijadikan nol. Nol berarti
 * outlet itu tidak berjualan sehari penuh — tuduhan yang berbeda jauh dari
 * "angkanya belum sampai", dan yang membacanya akan menelepon outlet yang
 * sebenarnya baik-baik saja.
 */
export function barisHarian(s: SumberHarian): BarisHarian {
  const bulanIni = jumlahAda(s.hari);
  /*
   * PEMBANDINGNYA HARI YANG SAMA PERSIS, bukan sepanjang tanggal terakhir yang
   * terisi.
   *
   * Dulu dipotong `slice(0, tanggal terakhir yang ada angkanya)`. Itu benar
   * selama lubangnya cuma di ujung. Begitu ada lubang di TENGAH — dan sekarang
   * banyak, karena penarikan ESB belum selesai — hasilnya menyesatkan berat:
   * bulan ini terisi dua hari, tanggal 3 dan 14, tapi pembandingnya dijumlah
   * tanggal 1–14 bulan lalu. Empat belas hari dilawan dua hari, dan tabelnya
   * mengumumkan outlet itu turun 85% padahal tidak ada yang turun.
   *
   * Yang dijumlah sekarang hanya tanggal yang bulan ini PUNYA angkanya.
   */
  const bulanLalu = jumlahAda(s.hari.map((v, i) => (v === null ? null : (s.hariLalu[i] ?? null))));

  const ubah = s.hari.map((v, i) =>
    i === 0 ? bandingHarian(s.akhirBulanLalu ?? null, v) : bandingHarian(s.hari[i - 1], v),
  );

  const target = s.targetBulan ?? null;
  const targetHarian = target === null || s.hari.length === 0 ? null : target / s.hari.length;
  const capaian = s.hari.map((v) =>
    v === null || targetHarian === null || targetHarian <= 0 ? null : (v / targetHarian) * 100,
  );
  const hariTerisi = s.hari.filter((v) => v !== null).length;
  const hariTercapai = capaian.filter((c) => c !== null && c >= BATAS_TERCAPAI).length;

  /*
   * DERETNYA HARUS BENAR-BENAR BERURUTAN.
   *
   * Dihitung mundur dari hari terakhir yang ada angkanya — hari di ujung yang
   * belum ditarik ESB memang bukan hari yang gagal, jadi itu dilewati.
   *
   * Tapi lubang di TENGAH tidak boleh ikut dilewati. Dulu dilewati semua, dan
   * akibatnya roket bertuliskan "5" untuk lima hari tercapai yang sebenarnya
   * tersebar di sepanjang bulan dengan hari-hari tak diketahui di antaranya —
   * lencana yang menjanjikan sesuatu yang tidak pernah diperiksa. Begitu
   * ketemu hari yang tidak diketahui, deretnya berhenti: yang tidak diketahui
   * bukan keberhasilan.
   */
  let deret = 0;
  let mulai = false;
  for (let i = capaian.length - 1; i >= 0; i -= 1) {
    if (s.hari[i] === null) {
      if (!mulai) continue; // ekor yang belum ditarik — belum masuk hitungan
      break; // lubang di tengah — sesudah sini tidak diketahui
    }
    mulai = true;
    if (capaian[i] !== null && (capaian[i] as number) >= BATAS_TERCAPAI) deret += 1;
    else break;
  }

  /*
   * SISA HARI ITU HARI YANG BELUM LEWAT, bukan hari yang belum ada angkanya.
   *
   * Dulu `jumlah hari − hari terisi`, dengan alasan penarikan ESB bertahap.
   * Alasan itu keliru, dan akibatnya dua-duanya salah arah:
   *
   *   – Bulan yang SUDAH SELESAI masih mengumumkan "Rp sekian/hari × 5 hari
   *     tersisa" padahal bulannya habis dan tidak ada satu hari pun tersisa.
   *   – Bulan berjalan menghitung hari yang sudah lewat tapi datanya belum
   *     masuk sebagai hari yang masih bisa dipakai mengejar. Tanggal 14 dengan
   *     5 hari terisi membaginya ke 25 hari, padahal yang tersisa 16 —
   *     kekurangan per harinya terbaca 36% lebih ringan daripada sebenarnya.
   *
   * Hari yang sudah lewat tidak bisa dikejar lagi, ditarik atau belum.
   */
  const sisaHari =
    s.hariBerjalan == null
      ? s.hari.length - hariTerisi
      : Math.max(0, s.hari.length - s.hariBerjalan);
  const kurang = target === null ? null : Math.max(0, target - (bulanIni ?? 0));
  const perHariSisa = kurang === null || sisaHari <= 0 ? null : kurang / sisaHari;

  return {
    ...s,
    bulanIni,
    bulanLalu,
    mom: bandingHarian(bulanLalu, bulanIni),
    ubah,
    targetHarian,
    capaian,
    capaianBulan: target === null || target <= 0 || bulanIni === null ? null : (bulanIni / target) * 100,
    hariTercapai,
    hariTerisi,
    lubang: s.hariBerjalan == null ? 0 : Math.max(0, Math.min(s.hariBerjalan, s.hari.length) - hariTerisi),
    deret,
    kurang,
    perHariSisa,
    sisaHari,
  };
}

/**
 * Sehari dihitung TERCAPAI mulai dari berapa persen target hariannya.
 *
 * Seratus persen pas hampir tidak pernah terjadi, dan menuntutnya membuat
 * hampir seluruh hari terbaca merah — lalu warnanya berhenti dibaca. Target
 * sebulan dibagi rata ke tiap hari juga bukan janji harian yang sebenarnya:
 * Senin dan Sabtu tidak pernah sama. Batas ini menandai hari yang berada di
 * jalurnya, bukan hari yang persis pas.
 */
export const BATAS_TERCAPAI = 100;

/** Seluruh baris, terbesar lebih dulu — yang paling besar paling dulu dibaca. */
export const urutHarian = (baris: BarisHarian[]): BarisHarian[] =>
  [...baris].sort((a, b) => (b.bulanIni ?? -1) - (a.bulanIni ?? -1));

/**
 * Baris gabungan — dijumlah per tanggal, bukan dirata-rata.
 *
 * HANYA OUTLET YANG PUNYA TARGET yang ikut. Aturannya sama dengan KPI: outlet
 * yang belum genap tiga bulan memang belum dinilai. Menjumlahkan penjualannya
 * tapi tidak targetnya akan membuat baris gabungan selalu terlihat melampaui
 * target — outlet baru menyumbang omzet tanpa menyumbang beban targetnya, dan
 * tidak ada satu pun tanda di layar bahwa angkanya tidak setara.
 *
 * Kalau belum ada satu pun outlet bertarget, seluruhnya tetap dijumlah supaya
 * tabelnya tidak kehilangan barisnya sama sekali — hanya tanpa target.
 */
export function totalHarian(baris: BarisHarian[], nama = "Seluruh outlet"): BarisHarian | null {
  if (baris.length === 0) return null;
  const bertarget = baris.filter((b) => (b.targetBulan ?? null) !== null);
  const ikut = bertarget.length ? bertarget : baris;
  const panjang = ikut[0].hari.length;
  const jumlahKolom = (ambil: (b: BarisHarian) => (number | null)[]) =>
    Array.from({ length: panjang }, (_, i) => jumlahAda(ikut.map((b) => ambil(b)[i] ?? null)));

  const akhir = ikut.map((b) => b.akhirBulanLalu ?? null).filter((n): n is number => n !== null);
  const target = ikut.map((b) => b.targetBulan ?? null).filter((n): n is number => n !== null);
  return barisHarian({
    outletId: "__total__",
    nama,
    area:
      bertarget.length && bertarget.length < baris.length
        ? `${ikut.length} dari ${baris.length} outlet — yang sudah bertarget`
        : `${ikut.length} outlet`,
    targetBulan: target.length ? target.reduce((a, b) => a + b, 0) : null,
    hari: jumlahKolom((b) => b.hari),
    hariLalu: jumlahKolom((b) => b.hariLalu),
    akhirBulanLalu: akhir.length ? akhir.reduce((a, b) => a + b, 0) : null,
    // Sama untuk seluruh baris — ini sifat BULANNYA, bukan sifat outletnya.
    hariBerjalan: ikut[0].hariBerjalan ?? null,
  });
}

/* ─────────────────────────────── per merek ─────────────────────────────── */

/**
 * Satu kartu merek — gabungan seluruh outlet bermerek itu.
 *
 * KENAPA PER MEREK, bukan cuma per outlet. Lima puluh delapan baris menjawab
 * "outlet mana yang tertinggal"; yang belum dijawab siapa pun adalah
 * pertanyaan satu tingkat di atasnya — MEREK mana yang sedang jalan. Empat
 * angka di atas tabel menjawabnya sebelum satu baris pun dibaca.
 */
export interface KartuMerek {
  merek: string;
  outlet: number;
  bulanIni: number | null;
  mom: number | null;
  targetBulan: number | null;
  /** Capaian terhadap target sebulan, dalam persen. */
  capaian: number | null;
  /** Angka tiap hari — pengisi grafik kecil di kartunya. */
  hari: (number | null)[];
}

/**
 * Kelompokkan baris harian menjadi kartu per merek.
 *
 * `merekDari` diserahkan pemanggil supaya berkas ini tetap tidak tahu apa-apa
 * soal penamaan outlet — aturannya tinggal di satu tempat, `lib/kpi/merek`.
 */
export function kartuMerek(
  baris: BarisHarian[],
  merekDari: (nama: string) => string | null,
  urutan: readonly string[],
): KartuMerek[] {
  const peta = new Map<string, BarisHarian[]>();
  for (const b of baris) {
    const m = merekDari(b.nama);
    if (!m) continue;
    peta.set(m, [...(peta.get(m) ?? []), b]);
  }

  const kartu: KartuMerek[] = [];
  for (const [merek, isi] of peta) {
    const gabung = totalHarian(isi, merek);
    if (!gabung) continue;
    kartu.push({
      merek,
      outlet: isi.length,
      bulanIni: gabung.bulanIni,
      mom: gabung.mom,
      targetBulan: gabung.targetBulan ?? null,
      capaian:
        gabung.targetBulan == null || gabung.targetBulan <= 0 || gabung.bulanIni === null
          ? null
          : (gabung.bulanIni / gabung.targetBulan) * 100,
      hari: gabung.hari,
    });
  }

  // Urutannya mengikuti daftar merek perusahaan, bukan besar-kecilnya angka:
  // kartu yang berpindah tempat tiap bulan memaksa orang mencarinya lagi
  // setiap kali membuka halaman.
  return kartu.sort((a, b) => urutan.indexOf(a.merek) - urutan.indexOf(b.merek));
}
