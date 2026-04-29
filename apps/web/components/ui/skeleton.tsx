import type { HTMLAttributes } from "react";

export function Skeleton({
  className = "",
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-md bg-white/5 animate-pulse ${className}`}
      aria-hidden
      {...rest}
    />
  );
}
