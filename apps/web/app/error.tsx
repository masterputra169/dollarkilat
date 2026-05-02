"use client";

import { useEffect } from "react";
import { Logo } from "@/components/brand/logo";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundary({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Surface to console for inspection. Replace with telemetry later.
    console.error("[app/error] runtime error caught:", error);
  }, [error]);

  // Heuristic: Next.js chunk loading failures throw with names/messages
  // mentioning "ChunkLoadError" or "Loading chunk". Force a hard reload to
  // bust the stale service-worker HTML pointing at the deleted chunk.
  const isChunkError =
    error.name === "ChunkLoadError" ||
    /Loading chunk|Failed to fetch dynamically imported module/i.test(
      error.message,
    );

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Logo iconOnly className="mb-6" />
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-fg-subtle)]">
        Error
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-fg)] sm:text-3xl">
        Terjadi kesalahan
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-[var(--color-fg-muted)]">
        {isChunkError
          ? "Versi app kamu sudah usang. Refresh halaman untuk muat ulang versi terbaru."
          : "Sesuatu yang gak terduga terjadi. Coba lagi atau kembali ke dashboard."}
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-[10px] text-[var(--color-fg-subtle)]">
          ref: {error.digest}
        </p>
      )}
      <div className="mt-7 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => {
            if (isChunkError && typeof window !== "undefined") {
              // Hard reload bypasses the SW navigation cache for this fetch.
              window.location.reload();
            } else {
              reset();
            }
          }}
          className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--color-fg)] px-5 text-sm font-semibold text-[var(--color-bg)] transition-opacity hover:opacity-90"
        >
          {isChunkError ? "Refresh halaman" : "Coba lagi"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.location.href = "/dashboard";
            }
          }}
          className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
        >
          Ke Dashboard
        </button>
      </div>
    </main>
  );
}
