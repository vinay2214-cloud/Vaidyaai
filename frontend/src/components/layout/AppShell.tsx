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

          {/* pb-24 reserves the height of MobileNav, which is `fixed bottom-0
              z-50` below the md breakpoint and therefore floats OVER page
              content. Only the dashboard used to allow for it, so on a phone
              the nav bar covered the bottom of every other page — including
              the consultation workspace, where it sat directly on top of
              "Stop & Generate SOAP Note". Tapping Stop hit the Billing link
              underneath it instead, which is why the QA pass saw the recorder
              navigate to /billing. Reserved here so no page can forget. */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-5 pb-24 md:pb-5">
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
