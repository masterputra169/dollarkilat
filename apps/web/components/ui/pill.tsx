import type { HTMLAttributes, ReactNode } from "react";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger";

interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  icon?: ReactNode;
}

const tones: Record<Tone, string> = {
  neutral:
    "bg-[--color-bg-subtle] text-[--color-fg-muted] border-[--color-border]",
  brand:
    "bg-[--color-brand-soft] text-[--color-brand-soft-fg] border-transparent",
  success: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50",
  warning: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50",
  danger: "bg-red-50 text-red-700 border-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50",
};

export function Pill({
  tone = "neutral",
  icon,
  className = "",
  children,
  ...rest
}: PillProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}
