/**
 * Pembungkus ZIP seadanya — hanya cukup untuk mengumpulkan bukti jadi satu berkas.
 *
 * KENAPA DITULIS SENDIRI, BUKAN MEMAKAI PUSTAKA. Yang dibutuhkan di sini
 * sempit sekali: menempelkan beberapa berkas yang SUDAH terkompresi (PDF, JPG,
 * PNG) menjadi satu arsip. Untuk itu ZIP punya metode `store` — disalin apa
 * adanya, tanpa dimampatkan. Mengompres ulang PDF hampir tidak memperkecil apa
 * pun, jadi seluruh bagian pustaka ZIP yang mahal justru bagian yang tidak
 * dipakai.
 *
 * BATASNYA, supaya tidak dipakai untuk hal yang bukan ini:
 *  • hanya metode `store`, tidak ada pemampatan;
 *  • tidak ada Zip64 — satu arsip di atas 4 GB akan rusak;
 *  • nama berkas ditulis sebagai UTF-8 dan ditandai begitu (bendera bit 11),
 *    supaya "Nordu Coffee Ayani – bukti.pdf" tidak berubah jadi sampah di
 *    Windows.
 */

/**
 * Tabel CRC-32 (polinomial 0xEDB88320) dibangun sekali saat modul dimuat.
 *
 * Menghitungnya bit demi bit untuk tiap byte membuat arsip berisi puluhan foto
 * terasa menggantung; tabel 256 entri menukar 1 KB memori dengan itu.
 */
const TABEL_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) c = TABEL_CRC[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Nama berkas yang aman di dalam arsip.
 *
 * Yang diambil hanya RUAS TERAKHIRNYA, dan titik berderet diratakan jadi satu:
 * nama seperti `../../etc/passwd` akan menempatkan berkas di luar folder tujuan
 * saat diekstrak oleh alat yang tidak memeriksanya. Nama itu datang dari berkas
 * yang diunggah orang, bukan dari kode ini, jadi ia tidak boleh dipercaya.
 */
export function namaAman(nama: string, urutan: number): string {
  const dasar = (nama || "").split(/[\\/]+/).pop() ?? "";
  const bersih = dasar.replace(/\.{2,}/g, ".").replace(/^[.\s-]+/, "").trim();
  return bersih || `bukti-${urutan + 1}`;
}

/** Nama yang sudah terpakai diberi "(2)", "(3)", … supaya tidak saling menimpa. */
export function namaUnik(nama: string, terpakai: Set<string>): string {
  if (!terpakai.has(nama)) {
    terpakai.add(nama);
    return nama;
  }
  const titik = nama.lastIndexOf(".");
  const pokok = titik > 0 ? nama.slice(0, titik) : nama;
  const akhiran = titik > 0 ? nama.slice(titik) : "";
  for (let i = 2; ; i += 1) {
    const calon = `${pokok} (${i})${akhiran}`;
    if (!terpakai.has(calon)) {
      terpakai.add(calon);
      return calon;
    }
  }
}

interface IsiZip {
  name: string;
  /** Sengaja `ArrayBuffer`, bukan `ArrayBufferLike`: `Blob` menolak potongan
   *  yang bersandar pada `SharedArrayBuffer`, dan itu baru ketahuan saat jalan. */
  data: Uint8Array<ArrayBuffer>;
}

function tulis32(buf: DataView, pos: number, nilai: number) {
  buf.setUint32(pos, nilai >>> 0, true);
}

/**
 * Susun beberapa berkas menjadi satu arsip ZIP.
 *
 * Nama yang kembar diberi urutan otomatis — dua outlet bisa saja mengunggah
 * berkas dengan nama "IMG_0001.jpg", dan arsip yang isinya saling menimpa
 * menghilangkan bukti tanpa ada yang sadar.
 */
export function buatZip(isi: IsiZip[]): Blob {
  const enc = new TextEncoder();
  const terpakai = new Set<string>();
  const berkas = isi.map((f, i) => {
    const nama = enc.encode(namaUnik(namaAman(f.name, i), terpakai));
    return { nama, data: f.data, crc: crc32(f.data) };
  });

  const bagian: BlobPart[] = [];
  const pusat: BlobPart[] = [];
  let offset = 0;

  for (const f of berkas) {
    const kepala = new Uint8Array(30 + f.nama.length);
    const dv = new DataView(kepala.buffer);
    tulis32(dv, 0, 0x04034b50); // local file header
    dv.setUint16(4, 20, true); // versi minimum
    dv.setUint16(6, 0x0800, true); // bendera: nama berkas UTF-8
    dv.setUint16(8, 0, true); // metode: store
    dv.setUint16(10, 0, true); // waktu — sengaja nol, arsipnya tidak dipakai untuk penanggalan
    dv.setUint16(12, 0, true); // tanggal
    tulis32(dv, 14, f.crc);
    tulis32(dv, 18, f.data.length);
    tulis32(dv, 22, f.data.length);
    dv.setUint16(26, f.nama.length, true);
    dv.setUint16(28, 0, true); // panjang extra field
    kepala.set(f.nama, 30);
    bagian.push(kepala, f.data);

    const cd = new Uint8Array(46 + f.nama.length);
    const cdv = new DataView(cd.buffer);
    tulis32(cdv, 0, 0x02014b50); // central directory header
    cdv.setUint16(4, 20, true);
    cdv.setUint16(6, 20, true);
    cdv.setUint16(8, 0x0800, true);
    cdv.setUint16(10, 0, true);
    cdv.setUint16(12, 0, true);
    cdv.setUint16(14, 0, true);
    tulis32(cdv, 16, f.crc);
    tulis32(cdv, 20, f.data.length);
    tulis32(cdv, 24, f.data.length);
    cdv.setUint16(28, f.nama.length, true);
    cdv.setUint16(30, 0, true);
    cdv.setUint16(32, 0, true);
    cdv.setUint16(34, 0, true);
    cdv.setUint16(36, 0, true);
    tulis32(cdv, 38, 0);
    tulis32(cdv, 42, offset);
    cd.set(f.nama, 46);
    pusat.push(cd);

    offset += kepala.length + f.data.length;
  }

  const panjangPusat = pusat.reduce((a, b) => a + (b as Uint8Array).length, 0);
  const akhir = new Uint8Array(22);
  const av = new DataView(akhir.buffer);
  tulis32(av, 0, 0x06054b50); // end of central directory
  av.setUint16(8, berkas.length, true);
  av.setUint16(10, berkas.length, true);
  tulis32(av, 12, panjangPusat);
  tulis32(av, 16, offset);

  return new Blob([...bagian, ...pusat, akhir], { type: "application/zip" });
}
