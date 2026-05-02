/**
 * Lightweight performance.mark wrapper for tracking payment latency.
 *
 * Marks are scoped per session and silently no-op when the Performance API
 * is unavailable (older mobile browsers in restricted modes).
 *
 * Pattern: mark("pay:scan_decoded") at lifecycle waypoints, then call
 * `summarizePay(label)` once on success to log a console.table of durations.
 *
 * Used for the Day 9 latency benchmark — see docs/BENCHMARK.md.
 */

const PAY_PREFIX = "pay:";

export function mark(name: string): void {
  if (typeof performance === "undefined" || !performance.mark) return;
  try {
    performance.mark(name);
  } catch {
    // ignore — performance buffer overflow or invalid name
  }
}

export function clearPayMarks(): void {
  if (typeof performance === "undefined") return;
  try {
    const all = performance.getEntriesByType("mark");
    for (const entry of all) {
      if (entry.name.startsWith(PAY_PREFIX)) {
        performance.clearMarks(entry.name);
      }
    }
  } catch {
    // ignore
  }
}

interface PaySpan {
  step: string;
  ms: number;
}

/**
 * Compute durations between consecutive pay:* marks and log to console.
 * Also returns the spans for further processing (e.g., analytics events).
 */
export function summarizePay(label = "payment"): PaySpan[] {
  if (typeof performance === "undefined") return [];
  try {
    const all = performance
      .getEntriesByType("mark")
      .filter((m): m is PerformanceMark => m.name.startsWith(PAY_PREFIX))
      .sort((a, b) => a.startTime - b.startTime);

    if (all.length < 2) return [];

    const spans: PaySpan[] = [];
    for (let i = 1; i < all.length; i++) {
      spans.push({
        step: `${stripPrefix(all[i - 1]!.name)} → ${stripPrefix(all[i]!.name)}`,
        ms: Math.round(all[i]!.startTime - all[i - 1]!.startTime),
      });
    }
    const total = Math.round(
      all[all.length - 1]!.startTime - all[0]!.startTime,
    );
    spans.push({ step: "TOTAL", ms: total });

    if (typeof console !== "undefined" && console.table) {
      console.groupCollapsed(`[perf] ${label} latency`);
      console.table(spans);
      console.groupEnd();
    }
    return spans;
  } catch {
    return [];
  }
}

function stripPrefix(name: string): string {
  return name.startsWith(PAY_PREFIX) ? name.slice(PAY_PREFIX.length) : name;
}
