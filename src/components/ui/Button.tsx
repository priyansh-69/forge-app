"use client";

import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

// ============================================================
// Button — The single button component for all of FORGE
// Variants: primary (brand), ghost (transparent), danger (red)
// Sizes: sm, md, lg
// ============================================================

type ButtonVariant = "primary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--brand-primary)] text-[var(--bg-primary)] hover:bg-[var(--brand-primary-hover)] font-semibold glow-brand",
  ghost:
    "bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]",
  danger:
    "bg-[var(--mode-truth)]/10 text-[var(--mode-truth)] hover:bg-[var(--mode-truth)]/20",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs rounded-[var(--radius-sm)]",
  md: "px-4 py-2.5 text-sm rounded-[var(--radius-md)]",
  lg: "px-6 py-3 text-base rounded-[var(--radius-md)]",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 transition-all duration-200 font-medium",
          "disabled:opacity-50 disabled:pointer-events-none",
          "active:scale-[0.97]",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button, type ButtonProps };
