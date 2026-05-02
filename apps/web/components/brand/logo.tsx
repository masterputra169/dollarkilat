import Image from "next/image";

interface LogoProps {
  className?: string;
  /** Show only the icon mark, no wordmark */
  iconOnly?: boolean;
}

export function Logo({ className = "", iconOnly = false }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image
        src="/liftapp.webp"
        alt="dollarkilat"
        width={1096}
        height={1436}
        priority
        className="h-8 w-auto"
      />
      {!iconOnly && (
        <span className="text-[15px] font-semibold tracking-tight text-[var(--color-fg)]">
          dollarkilat
        </span>
      )}
    </span>
  );
}
