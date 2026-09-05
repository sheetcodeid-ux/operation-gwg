import { describe, expect, it } from "vitest";
import { buatZip, crc32, namaAman, namaUnik } from "./zip";

const byte = (s: string) => new TextEncoder().encode(s) as Uint8Array<ArrayBuffer>;

describe("crc32", () => {
  it("cocok dengan nilai baku yang sudah dikenal", () => {
    // Nilai rujukan yang sama dipakai seluruh implementasi ZIP — kalau tabelnya
    // salah, arsipnya tetap terbentuk tapi ditolak saat dibuka.
    expect(crc32(byte("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});

describe("namaAman", () => {
  it("hanya menyisakan nama berkasnya, bukan jalurnya", () => {
    expect(namaAman("../../etc/passwd", 0)).toBe("passwd");
    expect(namaAman("bukti/hygiene.pdf", 0)).toBe("hygiene.pdf");
    expect(namaAman("..", 0)).toBe("bukti-1");
  });

  it("memberi nama pengganti bila namanya kosong", () => {
    expect(namaAman("", 2)).toBe("bukti-3");
    expect(namaAman("   ", 0)).toBe("bukti-1");
  });
});

describe("namaUnik", () => {
  it("tidak membiarkan dua berkas saling menimpa", () => {
    const dipakai = new Set<string>();
    expect(namaUnik("IMG_0001.jpg", dipakai)).toBe("IMG_0001.jpg");
    expect(namaUnik("IMG_0001.jpg", dipakai)).toBe("IMG_0001 (2).jpg");
    expect(namaUnik("IMG_0001.jpg", dipakai)).toBe("IMG_0001 (3).jpg");
  });

  it("tetap bekerja untuk nama tanpa akhiran", () => {
    const dipakai = new Set<string>();
    namaUnik("bukti", dipakai);
    expect(namaUnik("bukti", dipakai)).toBe("bukti (2)");
  });
});

describe("buatZip", () => {
  it("menghasilkan arsip berciri ZIP dengan jumlah berkas yang benar", async () => {
    const blob = buatZip([
      { name: "a.txt", data: byte("halo") },
      { name: "b.txt", data: byte("dunia") },
    ]);
    const buf = new Uint8Array(await blob.arrayBuffer());
    const dv = new DataView(buf.buffer);

    expect(blob.type).toBe("application/zip");
    // Tanda pengenal local file header di paling depan.
    expect(dv.getUint32(0, true)).toBe(0x04034b50);
    // End of central directory ada di 22 byte terakhir dan menyebut dua berkas.
    const akhir = buf.length - 22;
    expect(dv.getUint32(akhir, true)).toBe(0x06054b50);
    expect(dv.getUint16(akhir + 10, true)).toBe(2);
  });

  it("arsip kosong tetap sah", async () => {
    const buf = new Uint8Array(await buatZip([]).arrayBuffer());
    expect(buf.length).toBe(22);
    expect(new DataView(buf.buffer).getUint32(0, true)).toBe(0x06054b50);
  });
});
