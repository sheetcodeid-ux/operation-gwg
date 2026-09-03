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
aplikasi (`.next/static/chunks/*.css`, ambil yang paling besar), sebuah
`<div id="root">`, dan `preview.js`. Posisi yang dirender diambil dari
`location.hash`, misalnya `#pdq_food`.

Ganti `.preview/entry.tsx` untuk mempratinjau komponen lain. Data di dalamnya
CONTOH — jangan pernah dipakai sebagai angka sungguhan.

`next/navigation` diganti tiruan di `.preview/next-navigation-stub.ts`; di luar
Next, `useRouter` melempar galat dan seluruh halaman gagal dirender.
