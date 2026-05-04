"use client";

import { Languages } from "lucide-react";
import { useT } from "@/lib/i18n";

/**
 * Compact ID/EN toggle for the dashboard header. Single click swaps the
 * other way. Persists via lib/i18n's localStorage backing.
 *
 * Visual: lucide Languages icon + 2-letter code label, matches the
 * Settings/Install icon-button rhythm in the header (h-9 round pill).
 */
export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useT();
  const next: "id" | "en" = lang === "id" ? "en" : "id";

  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      aria-label={t("lang.toggle_aria")}
      title={lang === "id" ? "Switch to English" : "Ganti ke Bahasa Indonesia"}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold uppercase text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)] ${className}`}
    >
      <Languages className="size-3.5" />
      {lang.toUpperCase()}
    </button>
  );
}
