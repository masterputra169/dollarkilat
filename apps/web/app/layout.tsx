import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { InstallPrompt } from "@/components/install-prompt";
import { LanguageProvider } from "@/lib/i18n";
import { HistoryUrlPolyfill } from "./history-url-polyfill";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "dollarkilat — Earned in dollars, spend in rupiah",
    template: "%s | dollarkilat",
  },
  description:
    "Aplikasi pembayaran Indonesia-first untuk kamu yang dapat penghasilan dalam USDC. Scan QRIS, bayar instan.",
  manifest: "/manifest.webmanifest",
  applicationName: "dollarkilat",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "dollarkilat",
  },
  formatDetection: {
    telephone: false,
  },
  // Icons handled via Next.js file convention:
  //   app/icon.png       → favicon (browser tab)
  //   app/apple-icon.png → iOS home screen
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-aurora min-h-full flex flex-col relative">
        {/* LanguageProvider wraps EVERYTHING (landing + terms + authed) so
            useT() works regardless of route group. PrivyProvider stays
            scoped to (authed) since auth isn't needed on public pages. */}
        <LanguageProvider>
          <HistoryUrlPolyfill />
          {children}
          <InstallPrompt />
        </LanguageProvider>
      </body>
    </html>
  );
}
