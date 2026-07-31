"use client";

import React from "react";
import { cn } from "@/lib/cn";
import { Search } from "lucide-react";

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  shortcut?: string;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, shortcut, children, ...props }, ref) => {
    return (
      <div className={cn("relative flex items-center", className)}>
        <Search className="absolute left-3 w-4 h-4 text-foreground-subtle" />
        <input
          ref={ref}
          className="input-field pl-9 pr-10"
          {...props}
        />
        {shortcut && (
          <span className="absolute right-2 px-1.5 py-0.5 text-[10px] font-mono text-foreground-subtle bg-background-elevated border border-border rounded">
            {shortcut}
          </span>
        )}
      </div>
    );
  }
);
SearchInput.displayName = "SearchInput";
