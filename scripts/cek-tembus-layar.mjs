// Mengukur "tembus layar" secara nyata, bukan menebak dari kode.
//
// Untuk tiap halaman di lebar ponsel: apakah dokumennya lebih lebar dari
// layarnya? Kalau ya, elemen mana yang menyebabkannya — dilacak sampai ke
// simpul terdalam yang tepinya melewati batas kanan.
import { chromium, devices } from "playwright-core";
import crypto from "node:crypto";

const BASE = process.env.BASE || "http://localhost:3000";
const uid = "usr_001";
const payload = Buffer.from(`${uid}.${Date.now()}`).toString("base64url");
const sig = crypto.createHmac("sha256", "gwg-dev-secret-change-me-please").update(payload).digest("base64url");
const COOKIE = `${payload}.${sig}`;

const RUTE = [
  "/dashboard", "/pengajuan", "/system/pengajuan", "/system/antrian",
  "/it-helpdesk/pengajuan", "/it-helpdesk/antrian", "/work-tracker",
  "/hygiene", "/hospitality", "/complaints", "/outlets", "/events",
  "/reports", "/analytics", "/operation/fraud", "/operation/musiman",
  "/operation/laba-rugi", "/operation/beban", "/operation/pembelian",
  "/rnd/hpp", "/rnd/hpp/rekap", "/rnd/hpp/bahan", "/rnd/hpp/kompetitor",
  "/hc-mos", "/hc-mos/kontrak", "/hc/antrian", "/hc/permintaan",
  "/assessment", "/elearning", "/admin/users", "/profile",
];

const LEBAR = [
  { nama: "iPhone SE 375", w: 375, h: 667 },
  { nama: "iPhone 14 390", w: 390, h: 844 },
  { nama: "Android 360", w: 360, h: 800 },
];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const temuan = [];

for (const ukuran of LEBAR) {
  const ctx = await browser.newContext({
    ...devices["iPhone 13"],
    viewport: { width: ukuran.w, height: ukuran.h },
    isMobile: true,
    hasTouch: true,
  });
  await ctx.addCookies([{ name: "gwg_uid", value: COOKIE, url: BASE }]);
  const page = await ctx.newPage();

  for (const rute of RUTE) {
    try {
      await page.goto(BASE + rute, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(700);
      const hasil = await page.evaluate(() => {
        const de = document.documentElement;
        const lebarLayar = de.clientWidth;
        const lebarIsi = Math.max(de.scrollWidth, document.body.scrollWidth);
        if (lebarIsi <= lebarLayar + 1) return null;
        // Cari simpul TERDALAM yang tepi kanannya melewati layar — itu
        // penyebabnya, bukan induk-induk yang cuma ikut melebar.
        const jahat = [];
        for (const el of document.querySelectorAll("body *")) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.right <= lebarLayar + 1) continue;
          if ([...el.children].some((c) => c.getBoundingClientRect().right > lebarLayar + 1)) continue;
          jahat.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className?.toString?.() ?? "").slice(0, 110),
            right: Math.round(r.right),
            teks: (el.textContent ?? "").trim().slice(0, 45),
          });
        }
        return { lebarLayar, lebarIsi, jahat: jahat.slice(0, 4) };
      });
      if (hasil) temuan.push({ ukuran: ukuran.nama, rute, ...hasil });
    } catch (e) {
      temuan.push({ ukuran: ukuran.nama, rute, error: String(e).slice(0, 90) });
    }
  }
  await ctx.close();
}

await browser.close();
if (temuan.length === 0) {
  console.log("BERSIH — tidak ada halaman yang tembus layar.");
} else {
  for (const t of temuan) console.log(JSON.stringify(t));
  console.log("\nTOTAL TEMBUS:", temuan.length);
}
