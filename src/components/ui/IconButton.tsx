"use client";

import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

// ============================================================
// IconButton — Circular button for actions like record, play, pause
// ============================================================

type IconButtonSize = "sm" | "md" | "lg" | "xl";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: IconButtonSize;
  variant?: "default" | "brand" | "danger";
}

const sizeStyles: Record<IconButtonSize, string> = {
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-base",
  lg: "h-14 w-14 text-lg",
  xl: "h-20 w-20 text-2xl",
};

const variantStyles = {
  default: "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]",
  brand: "bg-[var(--brand-primary)] text-[var(--bg-primary)] hover:bg-[var(--brand-primary-hover)] glow-brand",
  danger: "bg-[var(--mode-truth)] text-white hover:bg-[var(--mode-truth)]/80",
};

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size = "md", variant = "default", disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-full transition-all duration-200",
          "disabled:opacity-50 disabled:pointer-events-none",
          "active:scale-[0.93]",
          sizeStyles[size],
          variantStyles[variant],
          className
        )}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = "IconButton";

export { IconButton, type IconButtonProps };
