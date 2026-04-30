"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

const IDLE_MS = 15 * 60 * 1000; // 15 menit
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "wheel",
] as const;

/**
 * Auto-logout setelah 15 menit no-activity. Mounted di (authed) route group
 * so it only runs when user is signed in.
 *
 * Why: payment apps shouldn't keep an open session indefinitely. Even
 * with Privy's biometric per-tx safeguard, a stolen unlocked device
 * within session window can drain quota (Rp 5jt/day in One-Tap). 15 min
 * idle is industry-standard for fintech (matches GoPay/Bank Jago web).
 *
 * Activity reset is throttled to one update per 5s so frequent mousemoves
 * don't dominate the main thread.
 */
export function IdleLogout() {
  const { authenticated, logout } = usePrivy();
  const router = useRouter();

  const lastActivityRef = useRef<number>(Date.now());
  const lastUpdateRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!authenticated) return;
    if (typeof window === "undefined") return;

    const onActivity = () => {
      const now = Date.now();
      // Throttle: only update at most once per 5s.
      if (now - lastUpdateRef.current < 5000) return;
      lastActivityRef.current = now;
      lastUpdateRef.current = now;
    };

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true });
    }

    timerRef.current = setInterval(() => {
      if (Date.now() - lastActivityRef.current < IDLE_MS) return;
      cleanup();
      toast.info("Sesi berakhir karena tidak aktif. Silakan masuk lagi.");
      logout()
        .then(() => router.replace("/login"))
        .catch(() => router.replace("/login"));
    }, 30_000); // poll every 30s — enough granularity, low overhead

    function cleanup() {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, onActivity);
      }
    }

    return cleanup;
  }, [authenticated, logout, router]);

  return null;
}
