import { Toaster } from "sonner";
import { Providers } from "../providers";
import { IdleLogout } from "@/components/session/idle-logout";

export default function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      {children}
      <IdleLogout />
      <Toaster
        position="top-center"
        richColors
        closeButton
        offset={{ top: "max(1rem, env(safe-area-inset-top))" }}
        mobileOffset={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
      />
    </Providers>
  );
}
