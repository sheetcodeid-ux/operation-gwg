import type { MetadataRoute } from "next";

/**
 * PWA manifest — controls the home-screen icon, name, and splash colours when
 * the app is opened/installed from a phone. Icons live in /public (white
 * background + original navy GWG logo).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Operation GWG",
    short_name: "GWG",
    description: "Sistem operasional internal GWG Group.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0e186c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
