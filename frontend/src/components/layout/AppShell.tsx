"use client";

import React, { useState, useEffect } from "react";
import { TopBar } from "./TopBar";
import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";
import { CommandPalette } from "./CommandPalette";
import { MobileNav } from "./MobileNav";
import { WalkInModal } from "@/components/WalkInModal";
import { ToastProvider } from "@/components/design-system";
import { useUIStore } from "@/store/uiStore";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        useUIStore.getState().setWalkInModalOpen(true);
      }
      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen]);

  return (
    <ToastProvider>
      <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
        <TopBar onSearchOpen={() => setSearchOpen(true)} />

        <div className="flex flex-1 overflow-hidden">
          <div className="hidden md:block">
            <LeftSidebar />
          </div>

          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-5">
            {children}
          </main>

          <div className="hidden xl:block">
            <RightSidebar />
          </div>
        </div>

        <MobileNav />

        <CommandPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
        <WalkInModal />
      </div>
    </ToastProvider>
  );
}
