"use client";

import React from "react";
import { cn } from "@/lib/cn";

interface PatientAvatarProps {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  status?: "online" | "offline" | "in-consultation";
}

export function PatientAvatar({ name, size = "md", className, status }: PatientAvatarProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const sizes = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
    xl: "w-16 h-16 text-xl",
  };

  const statusColors = {
    online: "bg-green-500",
    offline: "bg-gray-500",
    "in-consultation": "bg-teal-500",
  };

  return (
    <div className={cn("relative rounded-full bg-background-elevated border border-border flex items-center justify-center font-semibold text-foreground shrink-0", sizes[size], className)}>
      {initials}
      {status && (
        <span className={cn("absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background-panel", statusColors[status])} />
      )}
    </div>
  );
}
