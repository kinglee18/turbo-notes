import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary:
    "border border-[color-mix(in_oklab,var(--color-accent)_45%,transparent)] " +
    "bg-surface text-accent hover:bg-[color-mix(in_oklab,var(--color-accent)_12%,var(--color-surface))]",
  ghost: "text-muted hover:text-ink",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-0 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
