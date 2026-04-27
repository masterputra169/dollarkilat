import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "dollarkilat — Earned in dollars, spend in rupiah",
    short_name: "dollarkilat",
    description:
      "Aplikasi pembayaran Indonesia-first untuk kamu yang dapat penghasilan dalam USDC. Scan QRIS, bayar instan.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0066ff",
    orientation: "portrait",
    lang: "id-ID",
    dir: "ltr",
    categories: ["finance", "productivity"],
    icons: [
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
    shortcuts: [
      {
        name: "Bayar dengan QRIS",
        short_name: "Bayar",
        description: "Scan QRIS dan bayar pakai USDC",
        url: "/pay",
        icons: [{ src: "/icons/shortcut-pay.png", sizes: "96x96" }],
      },
      {
        name: "Terima USDC",
        short_name: "Terima",
        description: "Lihat alamat wallet kamu",
        url: "/receive",
        icons: [{ src: "/icons/shortcut-receive.png", sizes: "96x96" }],
      },
    ],
  };
}
