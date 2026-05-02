import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "dollarkilat — Earned in dollars, spend in rupiah",
    short_name: "dollarkilat",
    description:
      "Aplikasi pembayaran Indonesia-first untuk kamu yang dapat penghasilan dalam USDC. Scan QRIS, bayar instan.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    orientation: "portrait",
    lang: "id-ID",
    dir: "ltr",
    categories: ["finance", "productivity"],
    icons: [
      // PNGs are required by Chromium-family browsers (Chrome, Brave, Edge)
      // for PWA installability — without these, the install icon in the
      // address bar and the `beforeinstallprompt` event are suppressed.
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
