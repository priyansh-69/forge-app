"use client";

import { cn } from "@/lib/utils";
import { type HTMLAttributes, forwardRef } from "react";

// ============================================================
// Card — Container component used for entries, stats, coach response
// ============================================================

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass";
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-[var(--radius-lg)] p-4",
          variant === "default" &&
            "bg-[var(--bg-secondary)] border border-[var(--border-default)]",
          variant === "glass" && "glass",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export { Card, type CardProps };
