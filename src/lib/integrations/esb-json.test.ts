import { describe, expect, it } from "vitest";
import { bacaJsonEsb } from "./esb";
import { pesanRingkas } from "../pesan-galat";

/**
 * Penjaga terhadap galat penguraian yang bocor ke layar pengguna.
 *
 * Kejadian nyata: ESB membalas HTTP 200 berisi halaman HTML, bukan JSON. Kode
 * memanggil `res.json()` begitu saja, JavaScript melempar "Unexpected token
 * '<', \"<body styl\"... is not valid JSON", dan kalimat itu muncul apa adanya
 * sebagai notifikasi di layar orang yang membuka Fraud Analysis — tidak
 * menjelaskan apa pun, tidak menyarankan apa pun.
 *
 * Bentuk balasan di bawah memakai awalan yang benar-benar terlihat di layar
 * ("<body styl…"), bukan contoh karangan.
 */
const HTML_ASLI = '<body style="margin:0"><h1>502 Bad Gateway</h1><p>nginx</p></body>';

describe("balasan ESB yang bukan JSON", () => {
  it("tidak lagi melempar pesan penguraian mentah", () => {
    expect(() => bacaJsonEsb(HTML_ASLI, "report-cancel-menu-detail")).toThrow(/ESB membalas halaman web/);
    try {
      bacaJsonEsb(HTML_ASLI, "report-cancel-menu-detail");
    } catch (e) {
      const pesan = (e as Error).message;
      expect(pesan).not.toMatch(/Unexpected token/i);
      expect(pesan).not.toMatch(/is not valid JSON/i);
    }
  });

  it("menyimpan isi aslinya sebagai bukti penelusuran", () => {
    try {
      bacaJsonEsb(HTML_ASLI, "report-cancel-menu-detail");
    } catch (e) {
      // Tanpa ini, satu-satunya petunjuk kenapa ESB gagal ikut terbuang.
      expect((e as Error).message).toContain("502 Bad Gateway");
      expect((e as Error).message).toContain("report-cancel-menu-detail");
    }
  });

  it("yang sampai ke notifikasi hanya kalimat yang bisa dimengerti", () => {
    try {
      bacaJsonEsb(HTML_ASLI, "report-cancel-menu-detail");
    } catch (e) {
      const tampil = pesanRingkas((e as Error).message);
      expect(tampil).toBe(
        "ESB membalas halaman web, bukan data — biasanya karena ESB sedang bermasalah atau dalam pemeliharaan. Coba lagi beberapa menit lagi.",
      );
      expect(tampil).not.toContain("502"); // rinciannya tinggal di jejak galat
    }
  });

  it("halaman login ESB juga dikenali sebagai halaman, bukan data", () => {
    const login = '<!DOCTYPE html><html><body><form action="/site/login"><input type="password" name="LoginForm[password]"></form></body></html>';
    expect(() => bacaJsonEsb(login, "uji")).toThrow(/halaman web/);
  });

  it("JSON yang sah tetap terbaca seperti biasa", () => {
    expect(bacaJsonEsb<{ data: string }>('{"data":"https://x/y.json"}', "uji").data).toBe("https://x/y.json");
  });

  it("balasan kosong tidak membuatnya ikut rusak", () => {
    expect(() => bacaJsonEsb("", "uji")).toThrow(/tidak dikenali/);
  });
});
