import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "outline" | "subtle";
}

const variants: Record<NonNullable<CardProps["variant"]>, string> = {
  default:
    "bg-[var(--color-bg-elevated)] border border-[var(--color-border)] shadow-[var(--shadow-sm)]",
  elevated:
    "bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] shadow-[var(--shadow-md)]",
  outline: "bg-transparent border border-[var(--color-border)]",
  subtle: "bg-[var(--color-bg-subtle)] border border-transparent",
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
      className={`text-[10px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)] font-medium ${className}`}
    >
      {children}
    </p>
  );
}
