import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FORM = readFileSync(join(process.cwd(), "src/components/hygiene/hygiene-form.tsx"), "utf8");
const CAM = readFileSync(join(process.cwd(), "src/components/ui/camera-capture.tsx"), "utf8");

/**
 * Audit hygiene gagal terkirim di lapangan: bilahnya berhenti di
 * "Mengunggah foto 1/24 — 0%" selama 41 detik, lalu gagal. Setiap `it` di
 * bawah mengunci satu penyebab yang ditemukan, supaya tidak kembali diam-diam.
 */
describe("penangkapan foto hygiene", () => {
  it("foto diproses satu per satu, bukan serentak", () => {
    // `Promise.all` membuka beberapa foto mentah sekaligus di memori HP, dan
    // menolak SELURUH kumpulan begitu satu foto gagal.
    expect(CAM).not.toContain("Promise.all(files.map");
    expect(CAM).toContain("for (const f of files)");
  });

  it("foto yang gagal dilewati, TIDAK jatuh ke berkas mentah", () => {
    // Inilah akar masalahnya: jalur cadangan lama memakai file asli untuk
    // semuanya, sehingga 24 foto @ ~100 KB berubah jadi 24 foto @ ~4 MB.
    expect(CAM).not.toContain("files.map((f) => ({ file: f, url: URL.createObjectURL(f) }))");
    expect(CAM).toContain("gagal++");
  });

  it("pengubahan ukuran tidak lagi lewat base64", () => {
    // readAsDataURL menyalin foto 4 MB jadi teks ~5,4 MB sebelum digambar.
    expect(CAM).toContain("createImageBitmap(file");
    expect(CAM).not.toContain("r.readAsDataURL(file)");
  });

  it("memori bitmap dilepas setelah dipakai", () => {
    expect(CAM).toContain("img.close()");
  });
});

describe("pengiriman foto hygiene", () => {
  it("memakai XHR supaya kemajuannya nyata", () => {
    // fetch tidak melaporkan byte terkirim — bilahnya menunjukkan 0% terus.
    expect(FORM).toContain("xhr.upload.onprogress");
    expect(FORM).not.toContain('await fetch(url, { method: "PUT"');
  });

  it("punya batas waktu, tidak menggantung selamanya", () => {
    expect(FORM).toContain("xhr.timeout = timeoutMs");
    expect(FORM).toContain("xhr.ontimeout");
  });

  it("kemajuan dihitung per byte, bukan per berkas", () => {
    // Per berkas, foto pertama berarti 0% sampai selesai — tidak bisa
    // dibedakan dari macet.
    expect(FORM).toContain("uploadInfo.ratio");
    expect(FORM).not.toContain("uploadInfo.done / Math.max(1, uploadInfo.total)");
  });

  it("foto yang sudah naik tidak diunggah ulang", () => {
    // Gagal di foto ke-23 dulu berarti mengulang 22 foto dari nol.
    expect(FORM).toContain("doneRef.current.has(entries[i].file)");
    expect(FORM).toContain("doneRef.current.set(entries[i].file, att)");
  });

  it("kegagalan memberi tahu berapa foto yang selamat", () => {
    expect(FORM).toContain("${uploaded.length}/${entries.length} foto sudah tersimpan");
  });

  it('"Mulai baru" ikut membuang catatan unggahan lama', () => {
    expect(FORM).toContain("doneRef.current.clear()");
  });

  it("penolakan tetap tidak diulang percuma", () => {
    // 4xx selain 408/429 memang ditolak — mengulang membuang waktu petugas.
    expect(FORM).toContain("s !== 408 && s !== 429");
  });
});
