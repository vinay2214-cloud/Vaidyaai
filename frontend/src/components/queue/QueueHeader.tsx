"use client";

import React from "react";
import { SectionHeader, Button } from "@/components/design-system";
import { useUIStore } from "@/store/uiStore";
import { Calendar, PlusCircle } from "lucide-react";

interface QueueHeaderProps {
  total: number;
  waiting: number;
  completed: number;
}

export function QueueHeader({ total, waiting, completed }: QueueHeaderProps) {
  const setWalkInModalOpen = useUIStore((state) => state.setWalkInModalOpen);

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <SectionHeader
        icon={Calendar}
        title="Today's Queue"
        subtitle={`${total} patients • ${waiting} waiting • ${completed} completed`}
      />
      <Button onClick={() => setWalkInModalOpen(true)}>
        <PlusCircle className="w-4 h-4" />
        Walk-In Patient
      </Button>
    </div>
  );
}
