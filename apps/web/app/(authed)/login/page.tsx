"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

export default function LoginPage() {
  const { ready, authenticated, login } = usePrivy();
  const router = useRouter();
  const { t } = useT();

  useEffect(() => {
    if (ready && authenticated) {
      // Onboarding gate — consent page itself short-circuits to /dashboard
      // for users that already have an active consent row, so existing
      // users don't see it again.
      router.replace("/onboarding/consent");
    }
  }, [ready, authenticated, router]);

  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-10 sm:py-5">
        <Link
          href="/"
          className="-ml-2 inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          <ArrowLeft className="size-4" />
          {t("common.back")}
        </Link>
        <Logo iconOnly className="sm:hidden" />
      </div>

      <div className="relative flex flex-1 items-center justify-center px-5 pb-10 pt-4 sm:px-10 sm:pb-12">
        <div className="relative w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <Logo iconOnly className="mb-5" />
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-fg)]">
              {t("login.title")}
            </h1>
            <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
              {t("login.sub")}
            </p>
          </div>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!ready}
            loading={!ready}
            onClick={() => login()}
            leftIcon={<Mail className="size-4" />}
          >
            {ready ? t("login.cta") : t("login.loading")}
          </Button>

          <p className="mt-5 text-center text-xs leading-relaxed text-[var(--color-fg-subtle)]">
            {t("login.terms_prefix")}{" "}
            <Link
              href="/terms"
              className="text-[var(--color-fg-muted)] underline-offset-2 hover:text-[var(--color-fg)] hover:underline"
            >
              {t("login.terms_link")}
            </Link>
            .
          </p>

          <div className="mt-10 flex items-start gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--color-brand)]" />
            <p className="text-xs leading-relaxed text-[var(--color-fg-muted)]">
              {t("login.shield")}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
