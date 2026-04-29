interface LogoProps {
  className?: string;
  /** Show only the icon mark, no wordmark */
  iconOnly?: boolean;
}

export function Logo({ className = "", iconOnly = false }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className="relative flex size-7 items-center justify-center rounded-lg bg-[--color-brand] text-[--color-brand-fg] shadow-sm"
        aria-hidden
      >
        <span className="text-[15px] font-bold leading-none tracking-tight">
          $
        </span>
      </span>
      {!iconOnly && (
        <span className="text-[15px] font-semibold tracking-tight text-[--color-fg]">
          dollarkilat
        </span>
      )}
    </span>
  );
}
