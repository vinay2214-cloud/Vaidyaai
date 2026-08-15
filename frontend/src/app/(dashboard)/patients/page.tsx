"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useClinicStore } from "@/store/clinicStore";
import { useUIStore } from "@/store/uiStore";
import { PatientHeader } from "@/components/patients/PatientHeader";
import { PatientSearch, SortOption } from "@/components/patients/PatientSearch";
import { PatientFilterBar, PatientFilterType } from "@/components/patients/PatientFilterBar";
import { PatientCard, PatientData } from "@/components/patients/PatientCard";
import { SkeletonPatientCard } from "@/components/patients/SkeletonPatientCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Users } from "lucide-react";

export default function PatientIntelligencePage() {
  const router = useRouter();
  const clinicId = useClinicStore((state) => state.clinicId);
  const setWalkInModalOpen = useUIStore((state) => state.setWalkInModalOpen);

  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<PatientFilterType>("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchPatients = useCallback(async () => {
    if (!clinicId) return;
    try {
      setLoading(true);
      setError(false);
      const res = await api.get(`/patients?clinic_id=${clinicId}`);
      
      const enriched: PatientData[] = (res.data || []).map((p: any) => ({
        patient_id: p.patient_id || p.id,
        name: p.name || p.patient_name || "Patient",
        patient_phone_masked: p.phone_masked || p.patient_phone_masked || "+91XXXXXX3210",
        age: p.age ?? undefined,
        gender: p.gender ?? undefined,
        city: p.address || p.city || undefined,
        last_visit_str: p.last_visit_str || "Not recorded",
        chief_complaint: p.chief_complaint || p.complaint_summary || undefined,
        visit_type: p.visit_type || p.consultation_type || "General Consultation",
        status_badge: p.status_badge || (p.visit_count > 1 ? "FOLLOW-UP" : "TODAY"),
        risk_level: p.risk_level || undefined,
        consent_status: p.consent_given !== false ? "granted" : "pending",
        allergies: Array.isArray(p.allergies) ? p.allergies : [],
        chronic_diseases: Array.isArray(p.chronic_conditions) ? p.chronic_conditions : Array.isArray(p.chronic_diseases) ? p.chronic_diseases : [],
        has_ai_summary: Boolean(p.has_ai_summary),
        has_scribe_note: Boolean(p.has_scribe_note),
        has_retention_radar: Boolean(p.has_retention_radar)
      }));

      setPatients(enriched);
    } catch (e) {
      console.warn("Fetch patients error:", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      if (searchTerm.trim() !== "") {
        const query = searchTerm.toLowerCase();
        const matchName = p.name.toLowerCase().includes(query);
        const matchPhone = p.patient_phone_masked.toLowerCase().includes(query);
        const matchComplaint = p.chief_complaint?.toLowerCase().includes(query) || false;
        if (!matchName && !matchPhone && !matchComplaint) return false;
      }

      if (activeFilter === "TODAY") return p.status_badge === "TODAY" || p.last_visit_str === "Today";
      if (activeFilter === "HIGH_RISK") return p.risk_level === "HIGH" || p.risk_level === "CRITICAL" || p.status_badge === "HIGH RISK";
      if (activeFilter === "CHRONIC") return (p.chronic_diseases && p.chronic_diseases.length > 0) || p.status_badge === "CHRONIC";
      if (activeFilter === "FOLLOW_UP") return p.status_badge === "FOLLOW-UP";
      if (activeFilter === "OVERDUE") return p.status_badge === "OVERDUE";
      if (activeFilter === "NEW") return p.status_badge === "NEW";
      if (activeFilter === "CONSENT_PENDING") return p.consent_status === "pending";

      return true;
    });
  }, [patients, searchTerm, activeFilter]);

  const sortedPatients = useMemo(() => {
    const list = [...filteredPatients];
    if (sortBy === "alphabetical") {
      return list.sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sortBy === "highest_risk") {
      const weight: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      return list.sort((a, b) => (weight[b.risk_level || "LOW"] || 0) - (weight[a.risk_level || "LOW"] || 0));
    }
    return list;
  }, [filteredPatients, sortBy]);

  const filterCounts: Record<PatientFilterType, number> = useMemo(() => ({
    ALL: patients.length,
    TODAY: patients.filter((p) => p.status_badge === "TODAY" || p.last_visit_str === "Today").length,
    HIGH_RISK: patients.filter((p) => p.risk_level === "HIGH" || p.risk_level === "CRITICAL").length,
    CHRONIC: patients.filter((p) => p.chronic_diseases && p.chronic_diseases.length > 0).length,
    FOLLOW_UP: patients.filter((p) => p.status_badge === "FOLLOW-UP").length,
    OVERDUE: patients.filter((p) => p.status_badge === "OVERDUE").length,
    NEW: patients.filter((p) => p.status_badge === "NEW").length,
    CONSENT_PENDING: patients.filter((p) => p.consent_status === "pending").length,
    RECENTLY_ADDED: patients.length
  }), [patients]);

  return (
    <div className="space-y-5">

      {/* Demographics & Metadata Header */}
      <PatientHeader
        totalPatients={patients.length}
        highRiskCount={filterCounts.HIGH_RISK}
        chronicCount={filterCounts.CHRONIC}
        consentCount={patients.length}
        onAddWalkIn={() => setWalkInModalOpen(true)}
      />

      {/* Primary Patient Search Input */}
      <PatientSearch
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      {/* Filter Chips */}
      <PatientFilterBar
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        counts={filterCounts}
      />

      {/* Patient Cards List */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonPatientCard key={i} />
            ))}
          </div>
        ) : error ? (
          <ErrorState
            title="Unable to Load Patient Records"
            description="We could not retrieve patient records for this clinic. Please check your connection and try again."
            onRetry={fetchPatients}
          />
        ) : sortedPatients.length === 0 ? (
          <EmptyState
            title="No Matching Patient Records Found"
            description="Patients who register via WhatsApp (Agent 1) or Walk-in Reception will automatically appear here."
            icon={Users}
            actionLabel="Register Walk-In Patient"
            onAction={() => setWalkInModalOpen(true)}
          />
        ) : (
          sortedPatients.map((pat) => (
            <PatientCard
              key={pat.patient_id}
              patient={pat}
              onGenerateSummary={(id) => router.push(`/patients/${id}#summary`)}
              onSendFollowup={(id) => router.push(`/patients/${id}#retention`)}
            />
          ))
        )}
      </div>
    </div>
  );
}
