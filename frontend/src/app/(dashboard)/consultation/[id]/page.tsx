"use client";

import React, { useEffect, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useConsultation } from "@/hooks/useConsultation";
import { useClinicStore } from "@/store/clinicStore";
import { ConsultationWorkspace } from "@/components/consultation/ConsultationWorkspace";
import { Panel, Button } from "@/components/design-system";
import { Activity, Stethoscope, Calendar } from "lucide-react";

function ConsultationContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const consultationId = (params?.id as string) || "";
  const appointmentId = searchParams.get("appointment_id") || "";

  const clinicId = useClinicStore((state) => state.clinicId);
  const resetConsultation = useClinicStore((state) => state.resetConsultation);
  const setActiveConsultation = useClinicStore((state) => state.setActiveConsultation);

  const { consultation, loading, refresh, setConsultation } = useConsultation(consultationId);

  useEffect(() => {
    if (consultationId === "demo") {
      router.replace("/consultation");
    }
  }, [consultationId, router]);

  // Security & isolation guard
  useEffect(() => {
    if (consultation) {
      if (clinicId && consultation.clinic_id && consultation.clinic_id !== clinicId) {
        resetConsultation();
        router.push("/");
        return;
      }
      setActiveConsultation(
        consultation.consultation_id,
        (consultation as any).patient_id,
        consultation.appointment_id
      );
    }
  }, [consultation, clinicId, resetConsultation, setActiveConsultation, router]);

  const handleClearSession = () => {
    resetConsultation();
    setConsultation(null);
    refresh();
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Activity className="w-10 h-10 text-teal-400 animate-pulse" />
          <p className="text-foreground-muted text-sm font-medium">Loading consultation workspace...</p>
        </div>
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="max-w-2xl mx-auto mt-16 px-4">
        <Panel className="p-8 text-center space-y-4 bg-background-panel border border-border rounded-2xl shadow-lg">
          <div className="w-12 h-12 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mx-auto text-teal-400">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-foreground">No active consultation</h2>
            <p className="text-sm text-foreground-subtle max-w-md mx-auto">
              Select a patient from Today&apos;s Queue to start a new consultation session.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button onClick={() => router.push("/")} variant="primary" size="md">
              <Calendar className="w-4 h-4" />
              Today&apos;s Queue
            </Button>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div key={consultationId} className="animate-fade-in">
      <ConsultationWorkspace
        consultation={consultation}
        consultationId={consultationId}
        appointmentId={appointmentId}
        onDataChange={(data) => {
          setConsultation(data);
          refresh();
        }}
        onClear={handleClearSession}
        onApproved={() => refresh()}
      />
    </div>
  );
}

export default function ConsultationPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Activity className="w-10 h-10 text-teal-400 animate-pulse" />
            <p className="text-foreground-muted text-sm font-medium">Loading consultation workspace...</p>
          </div>
        </div>
      }
    >
      <ConsultationContent />
    </Suspense>
  );
}
