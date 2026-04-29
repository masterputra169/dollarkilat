import type { HTMLAttributes } from "react";

export function Skeleton({
  className = "",
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-md bg-[--color-bg-subtle] animate-pulse ${className}`}
      aria-hidden
      {...rest}
    />
  );
}
