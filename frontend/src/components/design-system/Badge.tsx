"use client";

import React from "react";
import { cn } from "@/lib/cn";

type BadgeVariant = "neutral" | "teal" | "blue" | "orange" | "red" | "green" | "gray" | "outline";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
  dotClassName?: string;
}

const variants: Record<BadgeVariant, string> = {
  neutral: "bg-background-elevated text-foreground border border-border",
  teal: "bg-teal-500/10 text-teal-400 border border-teal-500/30",
  blue: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
  orange: "bg-orange-500/10 text-orange-400 border border-orange-500/30",
  red: "bg-red-500/10 text-red-400 border border-red-500/30",
  green: "bg-green-500/10 text-green-400 border border-green-500/30",
  gray: "bg-gray-500/10 text-gray-400 border border-gray-500/30",
  outline: "bg-transparent text-foreground-muted border border-border",
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "neutral", dot, dotClassName, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn("badge", variants[variant], className)}
        {...props}
      >
        {dot && (
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              variant === "teal" && "bg-teal-400",
              variant === "blue" && "bg-blue-400",
              variant === "orange" && "bg-orange-400",
              variant === "red" && "bg-red-400",
              variant === "green" && "bg-green-400",
              variant === "gray" && "bg-gray-400",
              variant === "neutral" && "bg-foreground-muted",
              variant === "outline" && "bg-foreground-muted",
              dotClassName
            )}
          />
        )}
        {children}
      </span>
    );
  }
);
Badge.displayName = "Badge";
