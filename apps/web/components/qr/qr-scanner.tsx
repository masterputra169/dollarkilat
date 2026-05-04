"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImageUp, Pencil, RefreshCw, X } from "lucide-react";
import { useT } from "@/lib/i18n";

interface Props {
  /** Called when a QR is decoded. Caller decides whether to validate as QRIS. */
  onDecode: (raw: string) => void;
  /** Called on permission denial / device errors. */
  onError?: (err: Error) => void;
  /** Optional auto-start camera on mount. Default true. */
  autoStart?: boolean;
}

type Mode = "camera" | "upload" | "manual";

/**
 * QR scanner with three input modes:
 *   1. Live camera (uses native BarcodeDetector when available, falls back
 *      to qr-scanner's worker decoder via dynamic import — keeps initial
 *      bundle small).
 *   2. Image upload — for QRIS screenshots from chat / gallery.
 *   3. Manual paste — debug + accessibility fallback.
 *
 * The component is decode-only. It NEVER validates QRIS structure or talks
 * to the API; that's the parent's job.
 */
export function QRScanner({ onDecode, onError, autoStart = true }: Props) {
  const { t } = useT();
  const [mode, setMode] = useState<Mode>("camera");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualText, setManualText] = useState("");
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Lazy-loaded singleton — qr-scanner pulls a ~40kb worker, only when needed.
  const scannerRef = useRef<{
    stop(): void;
    destroy(): void;
  } | null>(null);

  // Probe camera availability once.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setHasCamera(false);
      return;
    }
    navigator.mediaDevices
      .enumerateDevices()
      .then((devs) =>
        setHasCamera(devs.some((d) => d.kind === "videoinput")),
      )
      .catch(() => setHasCamera(false));
  }, []);

  const stopCamera = useCallback(() => {
    scannerRef.current?.stop();
    scannerRef.current?.destroy();
    scannerRef.current = null;
  }, []);

  // Manual restart — used by the "refresh" button in the camera surface.
  const [restartTick, setRestartTick] = useState(0);

  // Single source of truth for camera lifecycle. Runs once per (mode, hasCamera,
  // restartTick) combination. Owns its own scanner instance via a closure
  // variable — the cleanup destroys *that specific* instance, so a torn-down
  // effect can never leak a second overlay onto the next mount's video.
  useEffect(() => {
    if (mode !== "camera" || hasCamera === false) return;
    if (!autoStart) return;
    const video = videoRef.current;
    if (!video) return;

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setError(t("scanner.camera.insecure"));
      return;
    }

    let aborted = false;
    let localInst: { stop(): void; destroy(): void } | null = null;

    setError(null);
    setBusy(true);

    (async () => {
      try {
        const QrScannerMod = (await import("qr-scanner")).default;
        if (aborted) return;
        const inst = new QrScannerMod(
          video,
          (result) => {
            stopCamera();
            onDecode(result.data);
          },
          {
            highlightScanRegion: true,
            highlightCodeOutline: true,
            maxScansPerSecond: 5,
            preferredCamera: "environment",
          },
        );
        if (aborted) {
          inst.destroy();
          return;
        }
        localInst = inst;

        // qr-scanner emits a hardcoded console.warn on non-HTTPS regardless
        // of Secure Context. On localhost the warning is misleading noise —
        // we already validated isSecureContext above. Filter that specific
        // message during start() and restore right after.
        const originalWarn = console.warn;
        console.warn = (...args: unknown[]) => {
          if (
            typeof args[0] === "string" &&
            args[0].includes("camera stream is only accessible if the page is transferred via https")
          ) {
            return;
          }
          originalWarn.apply(console, args);
        };
        try {
          await inst.start();
        } finally {
          console.warn = originalWarn;
        }
        if (aborted) {
          inst.stop();
          inst.destroy();
          localInst = null;
          return;
        }
        // Promote to shared ref so onDecode handler can stop on success.
        scannerRef.current = inst;
      } catch (err) {
        if (aborted) return;
        const msg = (err as Error).message ?? "camera_start_failed";
        const name = (err as Error & { name?: string }).name ?? "";

        const isBenignAbort =
          name === "AbortError" ||
          /interrupted by a new load request|aborted|removed from the document/i.test(
            msg,
          );
        if (isBenignAbort) return;

        const friendlyMsg =
          name === "NotAllowedError" || /Permission|NotAllowed/i.test(msg)
            ? t("scanner.camera.denied")
            : name === "NotFoundError"
              ? t("scanner.camera.not_found")
              : name === "NotReadableError"
                ? t("scanner.camera.busy")
                : msg;
        setError(friendlyMsg);
        onError?.(err as Error);
      } finally {
        if (!aborted) setBusy(false);
      }
    })();

    return () => {
      aborted = true;
      // Tear down *this* effect's instance, regardless of whether it was
      // promoted to scannerRef. This is what kills the duplicate overlay
      // that Strict Mode's first mount used to leak.
      if (localInst) {
        localInst.stop();
        localInst.destroy();
        localInst = null;
      }
      // If it was promoted, scannerRef points at the same inst — stopCamera
      // becomes a no-op since the instance is already destroyed. Clearing
      // the ref so the next mount starts fresh.
      if (scannerRef.current) {
        try {
          scannerRef.current.stop();
          scannerRef.current.destroy();
        } catch {
          // already destroyed above
        }
        scannerRef.current = null;
      }
    };
  }, [mode, hasCamera, autoStart, restartTick, onDecode, onError, stopCamera]);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const QrScannerMod = (await import("qr-scanner")).default;
      const result = await QrScannerMod.scanImage(file, {
        returnDetailedScanResult: true,
      });
      onDecode(result.data);
    } catch (err) {
      const msg = (err as Error).message ?? "scan_failed";
      setError(t("scanner.upload.no_qr", { reason: msg }));
      onError?.(err as Error);
    } finally {
      setBusy(false);
    }
  }

  function handleManualSubmit() {
    const v = manualText.trim();
    if (!v) {
      setError(t("scanner.manual.empty"));
      return;
    }
    // QRIS strings start with "00020101" (payload format indicator + version)
    // and the smallest valid spec example is well over 50 chars. Catch the
    // common "user pasted random text" case here so the parser doesn't
    // throw and trigger Next.js's dev error overlay.
    if (v.length < 50 || !v.startsWith("0002")) {
      setError(t("scanner.manual.invalid"));
      return;
    }
    onDecode(v);
  }

  const tabBtn = (m: Mode, icon: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => {
        setError(null);
        // Camera startup may have left `busy=true` if it was aborted mid-flight
        // when the user switched away. Reset so non-camera modes (Manual, Upload)
        // don't see a phantom-disabled submit button.
        setBusy(false);
        if (mode === "camera" && m !== "camera") stopCamera();
        setMode(m);
      }}
      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors ${
        mode === m
          ? "bg-white/[0.08] text-[var(--color-fg)]"
          : "text-[var(--color-fg-muted)] hover:bg-white/[0.04]"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-full border border-white/[0.06] bg-white/[0.02] p-1">
        {tabBtn("camera", <Camera className="size-3.5" />, t("scanner.tab.camera"))}
        {tabBtn("upload", <ImageUp className="size-3.5" />, t("scanner.tab.upload"))}
        {tabBtn("manual", <Pencil className="size-3.5" />, t("scanner.tab.manual"))}
      </div>

      {mode === "camera" && (
        <CameraSurface
          videoRef={videoRef}
          hasCamera={hasCamera}
          busy={busy}
          onRestart={() => setRestartTick((tick) => tick + 1)}
        />
      )}

      {mode === "upload" && (
        <UploadSurface
          busy={busy}
          onPick={(f) => handleFile(f)}
        />
      )}

      {mode === "manual" && (
        <div className="flex flex-col gap-2">
          <label
            htmlFor="qris-manual-input"
            className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]"
          >
            {t("scanner.manual.label")}
          </label>
          <textarea
            id="qris-manual-input"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="00020101021226660014ID.CO.QRIS.WWW…6304ABCD"
            rows={3}
            className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 font-mono text-[12px] text-[var(--color-fg)] placeholder:text-[var(--color-fg-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
          />
          <button
            type="button"
            onClick={handleManualSubmit}
            disabled={busy || manualText.trim().length < 50}
            className="btn-gradient-brand inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("scanner.manual.decode")}
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-[color-mix(in_oklab,var(--color-danger)_30%,transparent)] bg-[color-mix(in_oklab,var(--color-danger)_8%,transparent)] px-3 py-2 text-xs text-[var(--color-danger)]">
          {error}
        </div>
      )}
    </div>
  );
}

// ── camera ────────────────────────────────────────────────────

function CameraSurface({
  videoRef,
  hasCamera,
  busy,
  onRestart,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  hasCamera: boolean | null;
  busy: boolean;
  onRestart: () => void;
}) {
  const { t } = useT();
  if (hasCamera === false) {
    return (
      <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
        <X className="size-6 text-[var(--color-fg-subtle)]" />
        <p className="text-sm text-[var(--color-fg-muted)]">
          {t("scanner.camera.no_device")}
        </p>
      </div>
    );
  }
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-black">
      <video
        ref={videoRef}
        playsInline
        muted
        className="size-full object-cover"
      />
      {busy && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="size-6 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
        </div>
      )}
      <button
        type="button"
        onClick={onRestart}
        aria-label={t("scanner.camera.restart_aria")}
        className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70"
      >
        <RefreshCw className="size-3.5" />
      </button>
      <div className="pointer-events-none absolute inset-x-6 bottom-4 text-center text-[11px] text-white/70">
        {t("scanner.camera.aim")}
      </div>
    </div>
  );
}

// ── upload ────────────────────────────────────────────────────

function UploadSurface({
  busy,
  onPick,
}: {
  busy: boolean;
  onPick: (f: File) => void;
}) {
  const { t } = useT();
  return (
    <label className="group relative flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] p-6 text-center transition-colors hover:bg-white/[0.04]">
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = ""; // allow re-selecting the same file
        }}
        disabled={busy}
      />
      <div className="flex size-12 items-center justify-center rounded-xl bg-white/[0.05] text-[var(--color-fg-muted)] ring-1 ring-white/10 group-hover:text-[var(--color-fg)]">
        <ImageUp className="size-5" />
      </div>
      <p className="text-sm font-medium text-[var(--color-fg)]">
        {t("scanner.upload.cta")}
      </p>
      <p className="-mt-1 text-xs text-[var(--color-fg-muted)]">
        {t("scanner.upload.sub")}
      </p>
      {busy && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 backdrop-blur-sm">
          <div className="size-6 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
        </div>
      )}
    </label>
  );
}
