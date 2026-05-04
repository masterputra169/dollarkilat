"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { useT } from "@/lib/i18n";

export function TermsContent() {
  const { t } = useT();
  return (
    <main className="flex min-h-screen flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-4 sm:px-8">
        <Logo />
        <Link
          href="/login"
          className="-mr-2 inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          <ArrowLeft className="size-4" />
          {t("common.back")}
        </Link>
      </header>

      <article className="mx-auto w-full max-w-3xl px-5 pb-16 pt-4 sm:px-8 sm:pb-24">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
          {t("terms.eyebrow")}
        </p>
        <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-[var(--color-fg)] sm:text-4xl">
          {t("terms.title")}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-fg-subtle)]">
          {t("terms.version")}
        </p>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-[var(--color-fg-muted)]">
          <Section title={t("terms.s1.title")}>
            <p>{t("terms.s1.body")}</p>
          </Section>

          <Section title={t("terms.s2.title")}>
            <p>{t("terms.s2.body")}</p>
          </Section>

          <Section title={t("terms.s3.title")}>
            <p>{t("terms.s3.body")}</p>
          </Section>

          <Section title={t("terms.s4.title")}>
            <p>{t("terms.s4.intro")}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>{t("terms.s4.li1")}</li>
              <li>{t("terms.s4.li2")}</li>
              <li>{t("terms.s4.li3")}</li>
            </ul>
            <p className="mt-3">{t("terms.s4.outro")}</p>
          </Section>

          <Section title={t("terms.s5.title")}>
            <p>{t("terms.s5.body")}</p>
          </Section>

          <Section title={t("terms.s6.title")}>
            <p>{t("terms.s6.intro")}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>{t("terms.s6.li1")}</li>
              <li>{t("terms.s6.li2")}</li>
              <li>{t("terms.s6.li3")}</li>
            </ul>
            <p className="mt-3">
              <strong>{t("terms.s6.warn")}</strong>
            </p>
          </Section>

          <Section title={t("terms.s7.title")}>
            <p>{t("terms.s7.body")}</p>
          </Section>

          <Section title={t("terms.s8.title")}>
            <p>{t("terms.s8.body")}</p>
          </Section>

          <Section title={t("terms.s9.title")}>
            <p>
              {t("terms.s9.body")}{" "}
              <a
                href="mailto:hello@dollarkilat.xyz"
                className="text-[var(--color-fg)] underline underline-offset-2 hover:text-[var(--color-brand)]"
              >
                hello@dollarkilat.xyz
              </a>
            </p>
          </Section>
        </div>

        <div className="mt-12 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 text-sm text-[var(--color-fg-muted)]">
          {t("terms.footer")}
        </div>
      </article>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-[var(--color-fg)] sm:text-xl">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
