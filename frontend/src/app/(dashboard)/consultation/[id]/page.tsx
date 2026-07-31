"use client";

import React, { useEffect, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useConsultation } from "@/hooks/useConsultation";
import { useClinicStore } from "@/store/clinicStore";
import { ConsultationWorkspace } from "@/components/consultation/ConsultationWorkspace";
import { Panel } from "@/components/design-system";
import { Activity } from "lucide-react";

function ConsultationContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const consultationId = (params?.id as string) || "cons_demo";
  const appointmentId = searchParams.get("appointment_id") || "app_demo";

  const clinicId = useClinicStore((state) => state.clinicId);
  const resetConsultation = useClinicStore((state) => state.resetConsultation);
  const setActiveConsultation = useClinicStore((state) => state.setActiveConsultation);

  const { consultation, loading, refresh, setConsultation } = useConsultation(consultationId);

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
      <Panel className="max-w-xl mx-auto mt-12 p-6 text-center">
        <h2 className="text-lg font-semibold text-foreground">Consultation not found</h2>
        <p className="text-sm text-foreground-subtle mt-2">
          We could not load this consultation. Please check the ID or return to the queue.
        </p>
      </Panel>
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
