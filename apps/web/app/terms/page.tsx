import type { Metadata } from "next";
import { TermsContent } from "./terms-content";

// Server component for SEO-friendly metadata. Body is split into TermsContent
// (client) so the i18n Context (useT) works without sacrificing the metadata
// export which Next.js requires on a server module.
export const metadata: Metadata = {
  title: "Syarat Layanan",
  description:
    "Syarat layanan dollarkilat — aplikasi pembayaran Indonesia-first untuk pengguna USDC.",
};

export default function TermsPage() {
  return <TermsContent />;
}
