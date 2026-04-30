"use client";

import { useEffect, useRef } from "react";

type Props = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Pauses children's CSS animations when the wrapper is off-screen.
 * Animation `filter: blur(80px)` + `mix-blend-mode: screen` are paint-heavy
 * and run continuously by default — IntersectionObserver gates them so the
 * compositor stops repainting once the user scrolls past.
 */
export function AmbientStage({ children, className = "" }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.dataset.visible = "true";

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        el.dataset.visible = entry.isIntersecting ? "true" : "false";
      },
      { rootMargin: "120px 0px", threshold: 0 },
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} aria-hidden className={className}>
      {children}
    </div>
  );
}
