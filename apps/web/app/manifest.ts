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
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
