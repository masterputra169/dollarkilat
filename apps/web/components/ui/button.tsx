import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-ring] focus-visible:ring-offset-2 focus-visible:ring-offset-[--color-bg] cursor-pointer";

const variants: Record<Variant, string> = {
  primary:
    "bg-[--color-brand] text-[--color-brand-fg] hover:bg-[--color-brand-hover] shadow-sm",
  secondary:
    "bg-[--color-bg-elevated] text-[--color-fg] border border-[--color-border] hover:bg-[--color-bg-subtle]",
  ghost:
    "bg-transparent text-[--color-fg-muted] hover:bg-[--color-bg-subtle] hover:text-[--color-fg]",
  danger: "bg-[--color-danger] text-white hover:opacity-90 shadow-sm",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-6 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    fullWidth,
    loading,
    leftIcon,
    rightIcon,
    className = "",
    disabled,
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {loading ? (
        <span className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : (
        leftIcon
      )}
      {children}
      {!loading && rightIcon}
    </button>
  );
});
