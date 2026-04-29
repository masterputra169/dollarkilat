interface LogoProps {
  className?: string;
  /** Show only the icon mark, no wordmark */
  iconOnly?: boolean;
}

export function Logo({ className = "", iconOnly = false }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        className="relative flex size-8 items-center justify-center overflow-hidden rounded-[10px] bg-[var(--color-brand)] text-[var(--color-brand-fg)] shadow-[0_2px_8px_-2px_rgb(59_130_246_/_0.5)] ring-1 ring-inset ring-white/10"
        aria-hidden
      >
        {/* subtle shine */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-transparent"
        />
        <span className="relative text-[18px] font-bold leading-none tracking-tighter">
          $
        </span>
      </span>
      {!iconOnly && (
        <span className="text-[15px] font-semibold tracking-tight text-[var(--color-fg)]">
          dollarkilat
        </span>
      )}
    </span>
  );
}
