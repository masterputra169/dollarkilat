import type { HTMLAttributes } from "react";

export function Skeleton({
  className = "",
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-md bg-[var(--color-bg-subtle)] animate-pulse ${className}`}
      aria-hidden
      {...rest}
    />
  );
}
