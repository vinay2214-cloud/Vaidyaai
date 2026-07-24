"use client";

import React, { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useConsultation } from "@/hooks/useConsultation";
import { ConsultationRecorder } from "@/components/ConsultationRecorder";
import { SOAPNoteEditor } from "@/components/SOAPNoteEditor";
import { Stethoscope, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ConsultationPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const consultationId = (params?.id as string) || "cons_demo";
  const appointmentId = searchParams.get("appointment_id") || "app_demo";

  const { consultation, loading, refresh, setConsultation } = useConsultation(consultationId);

  return (
    <div className="space-y-6">
      {/* Back Link Header */}
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-teal-400" /> Active Consultation Workspace
          </h1>
          <p className="text-xs text-slate-400 font-mono">ID: {consultationId}</p>
        </div>
      </div>

      {/* Ambient Recorder Component */}
      <ConsultationRecorder
        consultationId={consultationId}
        appointmentId={appointmentId}
        onTranscribed={(data) => {
          setConsultation(data);
          refresh();
        }}
      />

      {/* SOAP Note Editor & Prescription Panel */}
      {consultation && (
        <SOAPNoteEditor
          consultation={consultation}
          onApproved={() => refresh()}
        />
      )}
    </div>
  );
}
