import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "outline" | "subtle";
}

const variants: Record<NonNullable<CardProps["variant"]>, string> = {
  default:
    "bg-[--color-bg-elevated] border border-[--color-border] shadow-[--shadow-sm]",
  elevated:
    "bg-[--color-bg-elevated] border border-[--color-border-subtle] shadow-[--shadow-md]",
  outline: "bg-transparent border border-[--color-border]",
  subtle: "bg-[--color-bg-subtle] border border-transparent",
};

export function Card({
  variant = "default",
  className = "",
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={`rounded-2xl ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

interface CardLabelProps {
  children: ReactNode;
  className?: string;
}

export function CardLabel({ children, className = "" }: CardLabelProps) {
  return (
    <p
      className={`text-[10px] uppercase tracking-[0.12em] text-[--color-fg-subtle] font-medium ${className}`}
    >
      {children}
    </p>
  );
}
