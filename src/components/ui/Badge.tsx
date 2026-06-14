"use client";

import { cn } from "@/lib/utils";
import { type HTMLAttributes } from "react";

// ============================================================
// Badge — Small label for points, streaks, emotion tags
// ============================================================

type BadgeVariant = "default" | "elevate" | "nudge" | "truth" | "points";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
  elevate: "bg-[var(--mode-elevate)]/15 text-[var(--mode-elevate)]",
  nudge: "bg-[var(--mode-nudge)]/15 text-[var(--mode-nudge)]",
  truth: "bg-[var(--mode-truth)]/15 text-[var(--mode-truth)]",
  points: "bg-[var(--brand-primary)]/15 text-[var(--brand-primary)]",
};

export function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-[var(--radius-full)]",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
