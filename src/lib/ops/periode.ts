import { jumlahHari, kolomHari, type HariKolom } from "./harian";
import { mingguBulan, tanggalMinggu } from "@/lib/kpi/minggu";

/**
 * SATU MODEL UNTUK LIMA SKALA — Daily, Weekly, Monthly, Quarterly, Yearly.
 *
 * Kelimanya menjawab pertanyaan yang sama ("kapan naik, kapan turun") pada
 * jarak pandang yang berbeda, dan angkanya berasal dari tabel yang sama:
 * `seasonal_daily`, satu baris per cabang per tanggal. Yang membedakan hanya
 * BAGAIMANA HARI-HARI ITU DIKELOMPOKKAN jadi kolom.
 *
 * Karena itu tidak ada lima halaman, lima tabel, dan lima perhitungan. Yang ada
 * satu tabel dan satu perhitungan, dengan berkas ini yang memutuskan kolomnya.
 * Lima salinan berarti lima perilaku yang lama-lama berbeda — dan perbedaan
 * pertama yang muncul pasti pada angka, bukan pada tampilan.
 *
 * MINGGUNYA IKUT DEFINISI YANG SUDAH ADA (`mingguBulan`): minggu ke-1 adalah
 * tanggal 1–7, dan seterusnya. Membuat definisi kedua di sini berarti "minggu
 * ke-3" di halaman Weekly bisa berbeda isinya dengan "minggu ke-3" di KPI
 * Coordinator Area — dua angka benar yang tidak bisa dipertemukan.
 */

export type Skala = "harian" | "mingguan" | "bulanan" | "kuartalan" | "tahunan";

/** Berapa tahun ke belakang yang ditampilkan halaman Yearly. */
export const TAHUN_TAMPIL = 5;

const BULAN_PENDEK = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"];
const BULAN_PANJANG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** Satu kolom, beserta rentang tanggal yang dijumlahkan ke dalamnya. */
export interface Ember {
  kolom: HariKolom;
  /** "YYYY-MM-DD", termasuk. */
  dari: string;
  /** "YYYY-MM-DD", termasuk. */
  sampai: string;
}

export interface Jendela {
  skala: Skala;
  /** "YYYY-MM" untuk harian & mingguan, "YYYY" untuk sisanya. */
  acuan: string;
  ember: Ember[];
  /** Rentang seluruh jendela — sekali baca ke basis data. */
  dari: string;
  sampai: string;
  /** Bulan-bulan yang tercakup, urut. Dipakai menjumlahkan target. */
  bulan: string[];
  /** Berapa kolom yang SUDAH LEWAT — penentu sisa dan lubang. */
  berjalan: number;
  /** Judul di penavigasi periode. */
  judul: string;
  judulPendek: string;
  /** Acuan satu langkah mundur dan maju. */
  sebelum: string;
  sesudah: string;
}

const p2 = (n: number) => String(n).padStart(2, "0");
const hariIniWib = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

/** Bulan "YYYY-MM" digeser `arah` bulan. */
export function geserBulan(periode: string, arah: number): string {
  const [th, bl] = periode.split("-").map(Number);
  const t = new Date(Date.UTC(th, bl - 1 + arah, 1));
  return `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}`;
}

/** Seluruh bulan "YYYY-MM" dari `dari` sampai `sampai`, termasuk keduanya. */
function bulanAntara(dari: string, sampai: string): string[] {
  const out: string[] = [];
  let b = dari.slice(0, 7);
  const akhir = sampai.slice(0, 7);
  while (b <= akhir && out.length < 200) {
    out.push(b);
    b = geserBulan(b, 1);
  }
  return out;
}

/**
 * Berapa kolom yang sudah lewat.
 *
 * Yang dihitung KOLOM YANG SUDAH DIMULAI, bukan yang sudah selesai: minggu
 * berjalan tetap dihitung berjalan walau baru tiga harinya lewat. Kalau tidak,
 * "sisa" di kolom terakhir selalu menghitung minggu ini sebagai belum dimulai
 * dan angkanya meleset seminggu penuh.
 */
function berjalanDari(ember: Ember[]): number {
  const kini = hariIniWib();
  return ember.filter((e) => e.dari <= kini).length;
}

/** Kolom-kolom sebuah jendela, lengkap dengan rentang tanggalnya. */
export function jendela(skala: Skala, acuan: string): Jendela {
  switch (skala) {
    case "harian": {
      const ember: Ember[] = kolomHari(acuan).map((k) => ({
        kolom: k,
        dari: `${acuan}-${p2(k.tanggal)}`,
        sampai: `${acuan}-${p2(k.tanggal)}`,
      }));
      const [th, bl] = acuan.split("-").map(Number);
      return {
        skala,
        acuan,
        ember,
        dari: ember[0].dari,
        sampai: ember[ember.length - 1].sampai,
        bulan: [acuan],
        berjalan: berjalanDari(ember),
        judul: `${BULAN_PANJANG[bl - 1]} ${th}`,
        judulPendek: `${BULAN_PENDEK[bl - 1]} ${String(th).slice(2)}`,
        sebelum: geserBulan(acuan, -1),
        sesudah: geserBulan(acuan, 1),
      };
    }

    case "mingguan": {
      const [th, bl] = acuan.split("-").map(Number);
      const ember: Ember[] = mingguBulan(acuan).map((m) => {
        const t = tanggalMinggu(acuan, m);
        return {
          // `tanggal` dipakai sebagai kunci dan urutan oleh tabelnya, jadi diisi
          // nomor minggunya. `label` yang tampil di kepala kolom.
          kolom: { tanggal: m.minggu, hari: `${p2(m.dari)}–${p2(m.sampai)}`, pekan: false, label: `M${m.minggu}` },
          dari: t.dari,
          sampai: t.sampai,
        };
      });
      return {
        skala,
        acuan,
        ember,
        dari: ember[0].dari,
        sampai: ember[ember.length - 1].sampai,
        bulan: [acuan],
        berjalan: berjalanDari(ember),
        judul: `${BULAN_PANJANG[bl - 1]} ${th}`,
        judulPendek: `${BULAN_PENDEK[bl - 1]} ${String(th).slice(2)}`,
        sebelum: geserBulan(acuan, -1),
        sesudah: geserBulan(acuan, 1),
      };
    }

    case "bulanan": {
      const th = Number(acuan);
      const ember: Ember[] = Array.from({ length: 12 }, (_, i) => {
        const b = `${th}-${p2(i + 1)}`;
        return {
          kolom: { tanggal: i + 1, hari: String(th).slice(2), pekan: false, label: BULAN_PENDEK[i] },
          dari: `${b}-01`,
          sampai: `${b}-${p2(jumlahHari(b))}`,
        };
      });
      return {
        skala,
        acuan,
        ember,
        dari: ember[0].dari,
        sampai: ember[11].sampai,
        bulan: ember.map((e) => e.dari.slice(0, 7)),
        berjalan: berjalanDari(ember),
        judul: String(th),
        judulPendek: String(th),
        sebelum: String(th - 1),
        sesudah: String(th + 1),
      };
    }

    case "kuartalan": {
      const th = Number(acuan);
      const ember: Ember[] = Array.from({ length: 4 }, (_, i) => {
        const awal = `${th}-${p2(i * 3 + 1)}`;
        const akhir = `${th}-${p2(i * 3 + 3)}`;
        return {
          kolom: {
            tanggal: i + 1,
            hari: `${BULAN_PENDEK[i * 3]}–${BULAN_PENDEK[i * 3 + 2]}`,
            pekan: false,
            label: `Q${i + 1}`,
          },
          dari: `${awal}-01`,
          sampai: `${akhir}-${p2(jumlahHari(akhir))}`,
        };
      });
      return {
        skala,
        acuan,
        ember,
        dari: ember[0].dari,
        sampai: ember[3].sampai,
        bulan: bulanAntara(ember[0].dari, ember[3].sampai),
        berjalan: berjalanDari(ember),
        judul: String(th),
        judulPendek: String(th),
        sebelum: String(th - 1),
        sesudah: String(th + 1),
      };
    }

    case "tahunan": {
      // Acuannya tahun TERAKHIR yang tampil; kolomnya mundur dari situ.
      const akhirTh = Number(acuan);
      const awalTh = akhirTh - (TAHUN_TAMPIL - 1);
      const ember: Ember[] = Array.from({ length: TAHUN_TAMPIL }, (_, i) => {
        const t = awalTh + i;
        return {
          kolom: { tanggal: t, hari: "", pekan: false, label: String(t) },
          dari: `${t}-01-01`,
          sampai: `${t}-12-31`,
        };
      });
      return {
        skala,
        acuan,
        ember,
        dari: ember[0].dari,
        sampai: ember[ember.length - 1].sampai,
        bulan: bulanAntara(ember[0].dari, ember[ember.length - 1].sampai),
        berjalan: berjalanDari(ember),
        judul: `${awalTh}–${akhirTh}`,
        judulPendek: `${String(awalTh).slice(2)}–${String(akhirTh).slice(2)}`,
        sebelum: String(akhirTh - 1),
        sesudah: String(akhirTh + 1),
      };
    }
  }
}

/**
 * Jendela SEBELUM `j`, dipakai sebagai pembanding "vs periode lalu".
 *
 * Bentuknya harus sama persis — jumlah kolom yang sama, urutan yang sama —
 * karena tabelnya membandingkan kolom demi kolom. Untuk harian dan mingguan
 * itu bulan sebelumnya; untuk yang lain, satu langkah acuan ke belakang.
 */
export function jendelaSebelum(j: Jendela): Jendela {
  return jendela(j.skala, j.sebelum);
}

/** Nama skala sebagaimana dibaca orang — judul halaman dan label kolom. */
export const NAMA_SKALA: Record<Skala, { menu: string; satuan: string; agregat: string }> = {
  harian: { menu: "Daily", satuan: "hari", agregat: "Bulan Ini" },
  mingguan: { menu: "Weekly", satuan: "minggu", agregat: "Bulan Ini" },
  bulanan: { menu: "Monthly", satuan: "bulan", agregat: "Tahun Ini" },
  kuartalan: { menu: "Quarterly", satuan: "kuartal", agregat: "Tahun Ini" },
  tahunan: { menu: "Yearly", satuan: "tahun", agregat: "Total" },
};
