"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUIStore } from "@/store/uiStore";
import { useToast } from "@/components/design-system";
import {
  Calendar,
  Users,
  Stethoscope,
  Cpu,
  CreditCard,
  BarChart3,
  Settings,
  PlusCircle,
  LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/design-system";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

const navItems: NavItem[] = [
  { label: "Today's Queue", href: "/", icon: Calendar },
  { label: "Patients", href: "/patients", icon: Users },
  { label: "Consultations", href: "/consultation/demo", icon: Stethoscope },
  { label: "AI Agents", href: "/logs", icon: Cpu },
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function LeftSidebar() {
  const pathname = usePathname();
  const setWalkInModalOpen = useUIStore((state) => state.setWalkInModalOpen);
  const { toast } = useToast();

  return (
    <aside className="w-60 bg-background-panel border-r border-border flex flex-col h-full shrink-0">
      <div className="p-4">
        <Button
          className="w-full justify-start"
          onClick={() => setWalkInModalOpen(true)}
        >
          <PlusCircle className="w-4 h-4" />
          Walk-In Patient
        </Button>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-250 focus-ring",
                isActive
                  ? "bg-teal-500/10 text-teal-400 border border-teal-500/30"
                  : "text-foreground-muted hover:text-foreground hover:bg-background-hover border border-transparent"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
              {item.badge && (
                <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold bg-teal-500 text-background rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="panel p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            AI Workforce Active
          </div>
          <p className="text-[10px] text-foreground-subtle">
            7 agents running. 0 failures today.
          </p>
        </div>
      </div>
    </aside>
  );
}
