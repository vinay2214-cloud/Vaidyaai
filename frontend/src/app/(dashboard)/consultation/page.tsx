"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useClinicStore } from "@/store/clinicStore";
import { useUIStore } from "@/store/uiStore";
import { Panel, Button } from "@/components/design-system";
import { Stethoscope, Calendar, PlusCircle } from "lucide-react";

export default function ConsultationIndexPage() {
  const router = useRouter();
  const activeConsultationId = useClinicStore((state) => state.activeConsultationId);
  const currentAppointmentId = useClinicStore((state) => state.currentAppointmentId);
  const setWalkInModalOpen = useUIStore((state) => state.setWalkInModalOpen);

  useEffect(() => {
    if (activeConsultationId) {
      const apptParam = currentAppointmentId ? `?appointment_id=${currentAppointmentId}` : "";
      router.replace(`/consultation/${activeConsultationId}${apptParam}`);
    }
  }, [activeConsultationId, currentAppointmentId, router]);

  if (activeConsultationId) {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto mt-16 px-4">
      <Panel className="p-8 text-center space-y-4 bg-background-panel border border-border rounded-2xl shadow-lg">
        <div className="w-12 h-12 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mx-auto text-teal-400">
          <Stethoscope className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-foreground">No active consultation</h2>
          <p className="text-sm text-foreground-subtle max-w-md mx-auto">
            Select a patient from Today&apos;s Queue or add a walk-in patient to start a new consultation session.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button onClick={() => router.push("/")} variant="primary" size="md">
            <Calendar className="w-4 h-4" />
            Today&apos;s Queue
          </Button>
          <Button onClick={() => setWalkInModalOpen(true)} variant="secondary" size="md">
            <PlusCircle className="w-4 h-4" />
            Add Walk-In Patient
          </Button>
        </div>
      </Panel>
    </div>
  );
}
