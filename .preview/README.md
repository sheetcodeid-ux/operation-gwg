# Pratinjau komponen

Bukan bagian aplikasi. Isinya satu jalan pintas untuk **melihat komponen di
peramban sebelum halamannya dipasang** — tanpa menjalankan Next, tanpa perlu
masuk akun, dan tanpa data sungguhan.

Dibuat karena satu aturan kerja: tampilan dikirim lebih dulu sebagai tangkapan
layar, baru dipasang. Tanpa alat ini, satu-satunya cara melihat halaman baru
adalah men-deploy-nya — persis yang tidak boleh dilakukan.

## Cara pakai

```bash
npx vite build --config vite.preview.config.mts
```

Hasilnya `.preview/dist/preview.js`. Buat satu berkas HTML yang memuat CSS
aplikasi, sebuah `<div id="root">`, dan `preview.js`.

CSS-nya **digabung dari SELURUH potongan**, bukan diambil yang paling besar:

```bash
cat .next/static/chunks/*.css > .preview/dist/app.css
```

Potongan terbesar memuat kelas-kelasnya tapi TIDAK memuat warna dasarnya
(`--color-card`, `--color-muted`). Akibatnya seluruh latar yang memakai warna
itu tampil bening di pratinjau — dan tangkapan layarnya memperlihatkan sel
yang saling tembus, kerusakan yang tidak pernah ada di aplikasi
sesungguhnya. Posisi yang dirender diambil dari
`location.hash`, misalnya `#pdq_food`.

Ganti `.preview/entry.tsx` untuk mempratinjau komponen lain. Data di dalamnya
CONTOH — jangan pernah dipakai sebagai angka sungguhan.

`next/navigation` diganti tiruan di `.preview/next-navigation-stub.ts`; di luar
Next, `useRouter` melempar galat dan seluruh halaman gagal dirender.
