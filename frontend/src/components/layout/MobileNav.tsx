"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUIStore } from "@/store/uiStore";
import { cn } from "@/lib/cn";
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

const navItems: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Queue", href: "/", icon: Calendar },
  { label: "Patients", href: "/patients", icon: Users },
  { label: "Consult", href: "/consultation/demo", icon: Stethoscope },
  { label: "AI", href: "/logs", icon: Cpu },
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();
  const setWalkInModalOpen = useUIStore((state) => state.setWalkInModalOpen);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background-panel border-t border-border flex items-center justify-around px-1 py-2">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors",
              isActive ? "text-teal-400" : "text-foreground-subtle"
            )}
          >
            <Icon className="w-5 h-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
      <button
        onClick={() => setWalkInModalOpen(true)}
        className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-medium text-teal-400"
      >
        <PlusCircle className="w-5 h-5" />
        <span>Add</span>
      </button>
    </nav>
  );
}
