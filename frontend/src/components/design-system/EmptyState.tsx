"use client";

import React from "react";
import { cn } from "@/lib/cn";
import { LucideIcon } from "lucide-react";
import { Button } from "./Button";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("panel p-8 flex flex-col items-center text-center gap-4", className)}>
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-background-elevated border border-border flex items-center justify-center">
          <Icon className="w-6 h-6 text-foreground-muted" />
        </div>
      )}
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-foreground-muted max-w-sm">{description}</p>
      </div>
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
