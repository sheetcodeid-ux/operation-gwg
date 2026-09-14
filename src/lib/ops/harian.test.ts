import { describe, expect, it } from "vitest";
import { barisHarian, bandingHarian, jumlahHari, kartuMerek, kolomHari, totalHarian, urutHarian } from "./harian";

describe("kolom hari", () => {
  it("menghitung panjang bulannya, termasuk Februari kabisat", () => {
    expect(jumlahHari("2026-09")).toBe(30);
    expect(jumlahHari("2026-08")).toBe(31);
    expect(jumlahHari("2026-02")).toBe(28);
    expect(jumlahHari("2024-02")).toBe(29);
  });

  it("menandai akhir pekan", () => {
    const k = kolomHari("2026-09");
    expect(k).toHaveLength(30);
    expect(k[0].tanggal).toBe(1);
    // 1 September 2026 jatuh hari Selasa.
    expect(k[0].hari).toBe("SEL");
    expect(k[0].pekan).toBe(false);
    expect(k.filter((h) => h.pekan).every((h) => h.hari === "SAB" || h.hari === "MIN")).toBe(true);
  });
});

describe("baris harian", () => {
  const sumber = {
    outletId: "o1",
    nama: "Nordu Tebas",
    area: "Deo",
    hari: [100, 120, 90, null, null],
    hariLalu: [80, 100, 100, 100, 100],
  };

  it("pembandingnya sepanjang hari yang SUDAH ada angkanya", () => {
    // Tiga hari dibandingkan dengan tiga hari, bukan dengan lima. Kalau
    // pembandingnya sebulan penuh, setiap outlet selalu terbaca minus besar
    // sepanjang bulan berjalan — angka yang tidak pernah salah dan tidak
    // pernah berguna.
    const b = barisHarian(sumber);
    expect(b.bulanIni).toBe(310);
    expect(b.bulanLalu).toBe(280);
    expect(b.mom).toBeCloseTo((30 / 280) * 100, 6);
  });

  it("perubahan tiap hari dihitung terhadap hari sebelumnya", () => {
    const b = barisHarian(sumber);
    expect(b.ubah[0]).toBeNull();
    expect(b.ubah[1]).toBeCloseTo(20, 6);
    expect(b.ubah[2]).toBeCloseTo(-25, 6);
    // Hari yang belum ditarik tidak menghasilkan perubahan apa pun.
    expect(b.ubah[3]).toBeNull();
  });

  it("tanggal 1 dibandingkan dengan hari terakhir bulan lalu", () => {
    // Satu-satunya kolom yang tidak punya "hari sebelumnya" — dan justru
    // pergantian bulan yang paling sering ditanyakan.
    const b = barisHarian({ ...sumber, akhirBulanLalu: 50 });
    expect(b.ubah[0]).toBeCloseTo(100, 6);
    expect(barisHarian(sumber).ubah[0]).toBeNull();
  });

  it("hari yang belum ditarik bukan nol", () => {
    // Nol berarti outlet itu tidak berjualan sehari penuh — tuduhan yang
    // berbeda jauh dari "angkanya belum sampai".
    const b = barisHarian({ ...sumber, hari: [null, null, null, null, null] });
    expect(b.bulanIni).toBeNull();
    expect(b.mom).toBeNull();
  });
});

describe("banding", () => {
  it("dasar nol atau minus tidak bisa jadi pembagi", () => {
    expect(bandingHarian(0, 100)).toBeNull();
    expect(bandingHarian(-5, 100)).toBeNull();
    expect(bandingHarian(null, 100)).toBeNull();
    expect(bandingHarian(100, null)).toBeNull();
  });
});

describe("urutan dan total", () => {
  const buat = (id: string, hari: (number | null)[]) =>
    barisHarian({ outletId: id, nama: id, area: "", hari, hariLalu: hari.map(() => 10) });

  it("terbesar lebih dulu, yang tanpa angka paling belakang", () => {
    const hasil = urutHarian([buat("a", [10, 10]), buat("b", [null, null]), buat("c", [50, 50])]);
    expect(hasil.map((b) => b.outletId)).toEqual(["c", "a", "b"]);
  });

  it("total dijumlah per tanggal, bukan dirata-rata", () => {
    const t = totalHarian([buat("a", [10, 20]), buat("c", [30, 40])]);
    expect(t?.hari).toEqual([40, 60]);
    expect(t?.bulanIni).toBe(100);
  });

  it("tanpa outlet tidak ada total", () => {
    expect(totalHarian([])).toBeNull();
  });
});

describe("pencapaian target harian", () => {
  const buat = (hari: (number | null)[], targetBulan: number | null) =>
    barisHarian({ outletId: "o1", nama: "A", area: "", targetBulan, hari, hariLalu: hari.map(() => 10) });

  it("target sehari = target sebulan dibagi jumlah hari", () => {
    const b = buat([100, 100, 100, 100], 400);
    expect(b.targetHarian).toBe(100);
    expect(b.capaian).toEqual([100, 100, 100, 100]);
    expect(b.hariTercapai).toBe(4);
  });

  it("hari yang di bawah target tidak dihitung tercapai", () => {
    const b = buat([120, 80, null, null], 400);
    expect(b.hariTercapai).toBe(1);
    expect(b.hariTerisi).toBe(2);
    expect(b.capaian[1]).toBeCloseTo(80, 6);
  });

  it("kekurangan omset = target sebulan dikurangi yang sudah masuk", () => {
    const b = buat([120, 80, null, null], 400);
    expect(b.bulanIni).toBe(200);
    expect(b.kurang).toBe(200);
    // Dua hari tersisa, jadi 100 per hari.
    expect(b.sisaHari).toBe(2);
    expect(b.perHariSisa).toBe(100);
  });

  it("target yang sudah terlampaui bukan kekurangan minus", () => {
    // Minus di kolom "kurang berapa lagi" terbaca seperti salah hitung.
    const b = buat([500, 200], 400);
    expect(b.kurang).toBe(0);
  });

  it("outlet tanpa target tidak dipaksa punya capaian", () => {
    // Outlet yang belum genap tiga bulan memang belum dinilai.
    const b = buat([100, 100], null);
    expect(b.targetHarian).toBeNull();
    expect(b.capaian).toEqual([null, null]);
    expect(b.kurang).toBeNull();
    expect(b.hariTercapai).toBe(0);
  });
});

describe("baris gabungan", () => {
  const buat = (id: string, hari: (number | null)[], targetBulan: number | null) =>
    barisHarian({ outletId: id, nama: id, area: "", targetBulan, hari, hariLalu: hari.map(() => 5) });

  it("hanya outlet bertarget yang ikut", () => {
    // Outlet baru menyumbang omzet tanpa menyumbang target — kalau ikut, baris
    // gabungan selalu terlihat melampaui target tanpa satu pun tanda.
    const t = totalHarian([buat("a", [100, 100], 400), buat("baru", [900, 900], null)]);
    expect(t?.hari).toEqual([100, 100]);
    expect(t?.targetBulan).toBe(400);
    expect(t?.area).toContain("1 dari 2 outlet");
  });

  it("tanpa satu pun outlet bertarget, seluruhnya tetap dijumlah", () => {
    const t = totalHarian([buat("a", [10, 10], null), buat("b", [20, 20], null)]);
    expect(t?.hari).toEqual([30, 30]);
    expect(t?.targetBulan).toBeNull();
  });
});

describe("kartu per merek", () => {
  const buat = (nama: string, hari: (number | null)[], targetBulan: number | null) =>
    barisHarian({ outletId: nama, nama, area: "", targetBulan, hari, hariLalu: hari.map(() => 50) });

  const merekDari = (n: string) => (n.startsWith("Nordu") ? "Nordu" : n.startsWith("Cattu") ? "Cattu" : null);
  const urutan = ["Nordu", "Cattu"];

  it("menjumlah seluruh outlet satu merek", () => {
    const k = kartuMerek(
      [buat("Nordu A", [100, 100], 400), buat("Nordu B", [50, 50], 200), buat("Cattu A", [10, 10], 40)],
      merekDari,
      urutan,
    );
    expect(k.map((x) => x.merek)).toEqual(["Nordu", "Cattu"]);
    expect(k[0].outlet).toBe(2);
    expect(k[0].bulanIni).toBe(300);
    expect(k[0].targetBulan).toBe(600);
    expect(k[0].capaian).toBeCloseTo(50, 6);
    expect(k[0].hari).toEqual([150, 150]);
  });

  it("urutannya tetap, tidak mengikuti besar-kecilnya angka", () => {
    // Kartu yang berpindah tempat tiap bulan memaksa orang mencarinya lagi
    // setiap kali membuka halaman.
    const k = kartuMerek([buat("Cattu A", [900], 100), buat("Nordu A", [1], 100)], merekDari, urutan);
    expect(k.map((x) => x.merek)).toEqual(["Nordu", "Cattu"]);
  });

  it("outlet yang mereknya tidak dikenali tidak dipaksa masuk kartu mana pun", () => {
    // Merek yang salah lebih buruk daripada merek yang tidak ditulis.
    const k = kartuMerek([buat("Warung Entah", [100], 100)], merekDari, urutan);
    expect(k).toEqual([]);
  });
});

describe("deret hari tercapai", () => {
  const buat = (hari: (number | null)[], targetBulan: number | null) =>
    barisHarian({ outletId: "o", nama: "o", area: "", targetBulan, hari, hariLalu: hari.map(() => 10) });

  it("dihitung mundur dari hari terakhir yang ada angkanya", () => {
    // target sehari = 100
    const b = buat([50, 120, 130, 140], 400);
    expect(b.deret).toBe(3);
    expect(b.hariTercapai).toBe(3);
  });

  it("putus begitu ada hari yang tidak tercapai", () => {
    const b = buat([120, 130, 50, 140], 400);
    expect(b.deret).toBe(1);
    expect(b.hariTercapai).toBe(3);
  });

  it("hari yang belum ditarik tidak memutus deretnya", () => {
    // Hari yang belum ditarik ESB bukan hari yang gagal; memutus deretnya di
    // situ menghukum outlet atas penarikan yang belum sampai.
    const b = buat([120, 130, null, null], 400);
    expect(b.deret).toBe(2);
  });

  it("outlet tanpa target tidak punya deret", () => {
    expect(buat([120, 130], null).deret).toBe(0);
  });
});

describe("capaian sebulan", () => {
  const buat = (hari: (number | null)[], targetBulan: number | null) =>
    barisHarian({ outletId: "o", nama: "o", area: "", targetBulan, hari, hariLalu: hari.map(() => 10) });

  it("dihitung dari target SEBULAN, bukan rata-rata capaian harian", () => {
    // Rata-rata capaian harian akan tersedot turun oleh hari yang belum
    // ditarik; yang ditanyakan justru "dari target sebulan, sudah sejauh mana".
    const b = buat([100, 100, null, null], 400);
    expect(b.capaianBulan).toBeCloseTo(50, 6);
  });

  it("tanpa target tidak ada capaiannya", () => {
    expect(buat([100], null).capaianBulan).toBeNull();
  });
});

/* ─────────────── lubang data: tiga kesalahan yang pernah lolos ─────────────── */

describe("barisHarian saat datanya berlubang", () => {
  const kosong = (n: number) => Array.from({ length: n }, () => null);

  it("membandingkan bulan lalu pada tanggal yang sama persis, bukan sepanjang tanggal terakhir", () => {
    // Bulan ini cuma tanggal 3 dan 14 yang tertarik. Bulan lalu lengkap.
    // Yang benar: 200 dilawan 200 → 0%. Yang dulu: 200 dilawan 1.400 → −85,7%.
    const hari = kosong(30);
    hari[2] = 100;
    hari[13] = 100;
    const b = barisHarian({
      outletId: "o", nama: "N", area: "A",
      hari,
      hariLalu: Array.from({ length: 30 }, () => 100),
    });
    expect(b.bulanIni).toBe(200);
    expect(b.bulanLalu).toBe(200);
    expect(b.mom).toBe(0);
  });

  it("deret berhenti di lubang tengah, tapi tetap melewati ekor yang belum ditarik", () => {
    // target 3.000 sebulan atas 30 hari → 100/hari.
    // tanggal 1-2 tercapai, 3 belum ditarik, 4-5 tercapai, 6-30 belum ditarik.
    // Deret yang jujur = 2 (tanggal 4 dan 5), bukan 4.
    const hari = kosong(30);
    hari[0] = 150; hari[1] = 150; hari[3] = 150; hari[4] = 150;
    const b = barisHarian({
      outletId: "o", nama: "N", area: "A", targetBulan: 3_000,
      hari, hariLalu: kosong(30),
    });
    expect(b.hariTercapai).toBe(4);
    expect(b.deret).toBe(2);
  });

  it("sisa hari mengejar dihitung dari hari yang belum lewat, bukan yang belum ada angkanya", () => {
    const hari = kosong(30);
    hari[0] = 100; // baru 1 hari yang tertarik
    const dasar = { outletId: "o", nama: "N", area: "A", targetBulan: 3_000, hari, hariLalu: kosong(30) };

    // Tanggal 14: yang tersisa 16 hari, bukan 29.
    const berjalan = barisHarian({ ...dasar, hariBerjalan: 14 });
    expect(berjalan.sisaHari).toBe(16);
    expect(berjalan.kurang).toBe(2_900);
    expect(berjalan.perHariSisa).toBeCloseTo(2_900 / 16);

    // Bulan yang sudah habis: tidak ada satu hari pun tersisa untuk mengejar.
    const selesai = barisHarian({ ...dasar, hariBerjalan: 30 });
    expect(selesai.sisaHari).toBe(0);
    expect(selesai.perHariSisa).toBeNull();
  });

  it("menghitung lubang: hari yang sudah lewat tapi angkanya belum ada", () => {
    const hari = kosong(30);
    hari[0] = 100;
    hari[5] = 100; // dua hari terisi dari empat belas yang sudah lewat
    const b = barisHarian({
      outletId: "o", nama: "N", area: "A",
      hari, hariLalu: kosong(30), hariBerjalan: 14,
    });
    expect(b.hariTerisi).toBe(2);
    expect(b.lubang).toBe(12);

    // Tanpa keterangan hari berjalan, lubangnya tidak diklaim ada.
    const tanpa = barisHarian({ outletId: "o", nama: "N", area: "A", hari, hariLalu: kosong(30) });
    expect(tanpa.lubang).toBe(0);

    // Bulan yang datanya utuh tidak berlubang.
    const utuh = barisHarian({
      outletId: "o", nama: "N", area: "A",
      hari: [...Array.from({ length: 14 }, () => 100), ...kosong(16)],
      hariLalu: kosong(30), hariBerjalan: 14,
    });
    expect(utuh.lubang).toBe(0);
  });

  it("totalHarian meneruskan hari berjalan ke baris gabungannya", () => {
    const buat = (id: string) =>
      barisHarian({
        outletId: id, nama: id, area: "A", targetBulan: 3_000,
        hari: [100, ...kosong(29)], hariLalu: kosong(30), hariBerjalan: 14,
      });
    const t = totalHarian([buat("a"), buat("b")]);
    expect(t?.sisaHari).toBe(16);
  });
});
