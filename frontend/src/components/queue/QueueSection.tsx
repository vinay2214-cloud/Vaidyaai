"use client";

import React from "react";
import { cn } from "@/lib/cn";
import { Appointment } from "@/hooks/useAppointmentsToday";
import { QueuePatientRow } from "./QueuePatientRow";
import { Badge } from "@/components/design-system";

interface QueueSectionProps {
  title: string;
  appointments: Appointment[];
  priority?: "green" | "yellow" | "orange" | "red";
  emptyText?: string;
}

const priorityConfig = {
  green: { label: "On Track", color: "green" as const, border: "border-green-500/30" },
  yellow: { label: "Building Up", color: "orange" as const, border: "border-orange-500/30" },
  orange: { label: "Delayed", color: "orange" as const, border: "border-orange-500/30" },
  red: { label: "Critical", color: "red" as const, border: "border-red-500/30" },
};

export function QueueSection({ title, appointments, priority = "green", emptyText = "No patients in this section" }: QueueSectionProps) {
  if (appointments.length === 0) return null;

  const cfg = priorityConfig[priority];

  return (
    <div className={cn("panel p-4 border-l-4", cfg.border)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <Badge variant={cfg.color} dot>{cfg.label}</Badge>
      </div>
      <div className="space-y-2">
        {appointments.map((appt) => (
          <QueuePatientRow key={appt.appointment_id} appointment={appt} />
        ))}
      </div>
    </div>
  );
}
