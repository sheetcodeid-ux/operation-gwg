"use client";

import * as React from "react";

/**
 * Tinggi layar yang BENAR-BENAR terlihat, termasuk saat papan ketik terbuka.
 *
 * `100dvh` tidak menyusut ketika papan ketik ponsel muncul. Akibatnya bagian
 * bawah aplikasi terdorong keluar layar, browser menggulir untuk mengejar
 * kolom isian, dan kepala percakapan — foto serta nama lawan bicara — hilang
 * dari pandangan.
 *
 * `visualViewport` melaporkan tinggi yang tersisa di atas papan ketik. Dengan
 * mengunci tinggi wadah ke angka itu, kepala percakapan tetap di tempatnya dan
 * hanya daftar pesan yang menyusut — persis seperti aplikasi pesan biasa.
 */
export function useViewportHeight(): number | null {
  const [h, setH] = React.useState<number | null>(null);

  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const apply = () => {
      // Papan ketik yang terbuka juga MENGGESER viewport; offsetTop harus ikut
      // dikurangi, kalau tidak wadahnya jadi lebih tinggi dari yang terlihat.
      setH(Math.round(vv.height + vv.offsetTop));
    };
    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
    };
  }, []);

  return h;
}
