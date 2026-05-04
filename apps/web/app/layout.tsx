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

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://dollarkilat.xyz";

const SITE_TITLE = "dollarkilat — Earned in dollars, spend in rupiah";
const SITE_DESCRIPTION =
  "Indonesia-first payment app for people who earn in USDC. Scan any QRIS code and pay instantly from your stablecoin balance — no hassle, no manual conversion.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | dollarkilat",
  },
  description: SITE_DESCRIPTION,
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
  keywords: [
    "USDC",
    "stablecoin",
    "QRIS",
    "Indonesia",
    "payment app",
    "rupiah",
    "freelancer",
    "remote worker",
    "content creator",
    "Solana",
    "PWA",
    "fintech",
    "crypto payment",
    "stablecoin wallet",
  ],
  authors: [{ name: "dollarkilat" }],
  creator: "dollarkilat",
  publisher: "dollarkilat",
  alternates: {
    canonical: "/",
    languages: {
      "id-ID": "/",
      "en-US": "/",
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["id_ID"],
    url: SITE_URL,
    siteName: "dollarkilat",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    // /opengraph-image is auto-generated from app/opengraph-image.tsx
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    // /twitter-image is auto-generated from app/twitter-image.tsx (re-exports OG)
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "finance",
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
      lang="en"
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
