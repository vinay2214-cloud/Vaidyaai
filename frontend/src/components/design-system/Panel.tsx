"use client";

import React from "react";
import { cn } from "@/lib/cn";

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className, padding = "md", hover = false, children, ...props }, ref) => {
    const paddings = {
      none: "",
      sm: "p-3",
      md: "p-4",
      lg: "p-5",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "panel",
          paddings[padding],
          hover && "panel-hover",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Panel.displayName = "Panel";
