"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { useAppointmentsToday } from "@/hooks/useAppointmentsToday";
import { useClinicStore } from "@/store/clinicStore";
import {
  Search,
  User,
  FileText,
  Pill,
  FlaskConical,
  Stethoscope,
  Receipt,
  FileCode,
  Phone,
  X,
  CornerDownLeft,
} from "lucide-react";
import { useToast } from "@/components/design-system";

interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const clinicId = useClinicStore((state) => state.clinicId);
  const { appointments } = useAppointmentsToday();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const executeResult = React.useCallback(
    (result: SearchResult) => {
      if (result.href) {
        router.push(result.href);
        onClose();
      } else if (result.onClick) {
        result.onClick();
        onClose();
      } else {
        toast(`Selected ${result.title}`, "info");
        onClose();
      }
    },
    [router, onClose, toast]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (!isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % results.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + results.length) % results.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = results[selectedIndex];
        if (selected) executeResult(selected);
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, selectedIndex, results, executeResult]);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.toLowerCase().trim();
    const items: SearchResult[] = [
      { id: "nav_queue", type: "Navigation", title: "Today's Queue", subtitle: "Home", icon: <Search className="w-4 h-4" />, href: "/" },
      { id: "nav_patients", type: "Navigation", title: "Patients", subtitle: "Patient registry", icon: <User className="w-4 h-4" />, href: "/patients" },
      { id: "nav_billing", type: "Navigation", title: "Billing", subtitle: "Invoices & payments", icon: <Receipt className="w-4 h-4" />, href: "/billing" },
      { id: "nav_analytics", type: "Navigation", title: "Analytics", subtitle: "Practice intelligence", icon: <FileText className="w-4 h-4" />, href: "/analytics" },
      { id: "nav_settings", type: "Navigation", title: "Settings", subtitle: "AI operations center", icon: <Stethoscope className="w-4 h-4" />, href: "/settings" },
      { id: "icd_fever", type: "ICD-10", title: "R50.9 - Fever, unspecified", subtitle: "ICD-10 code", icon: <FileCode className="w-4 h-4" /> },
      { id: "icd_diabetes", type: "ICD-10", title: "E11.9 - Type 2 diabetes mellitus", subtitle: "ICD-10 code", icon: <FileCode className="w-4 h-4" /> },
      { id: "icd_hypertension", type: "ICD-10", title: "I10 - Essential hypertension", subtitle: "ICD-10 code", icon: <FileCode className="w-4 h-4" /> },
      { id: "med_paracetamol", type: "Medication", title: "Paracetamol 650mg", subtitle: "Tablet • TDS PRN", icon: <Pill className="w-4 h-4" /> },
      { id: "med_metformin", type: "Medication", title: "Metformin 500mg", subtitle: "Tablet • BD", icon: <Pill className="w-4 h-4" /> },
      { id: "lab_hba1c", type: "Lab", title: "HbA1c Glycated Hemoglobin", subtitle: "Endocrinology", icon: <FlaskConical className="w-4 h-4" /> },
      { id: "lab_rft", type: "Lab", title: "Renal Function Test", subtitle: "Nephrology", icon: <FlaskConical className="w-4 h-4" /> },
      { id: "phone_support", type: "Help", title: "Support Phone", subtitle: "+91-XXXX-XXX3210", icon: <Phone className="w-4 h-4" /> },
    ];

    appointments.forEach((appt) => {
      items.push({
        id: `appt_${appt.appointment_id}`,
        type: "Patient",
        title: appt.patient_name || "Patient",
        subtitle: `${appt.patient_phone_masked} • ${appt.complaint_summary || "Consultation"}`,
        icon: <User className="w-4 h-4" />,
        href: `/consultation/${appt.appointment_id}?appointment_id=${appt.appointment_id}`,
      });
    });

    if (!q) return items;
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q)
    );
  }, [query, appointments, clinicId]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen || typeof window === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-24" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-background-panel border border-border rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-5 h-5 text-foreground-subtle" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search patient, phone, invoice, SOAP, ICD, medication..."
            className="flex-1 bg-transparent text-base text-foreground placeholder:text-foreground-subtle focus:outline-none"
            aria-label="Universal search"
          />
          <button onClick={onClose} className="p-1 text-foreground-subtle hover:text-foreground focus-ring rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="py-8 text-center text-sm text-foreground-subtle">
              No results found for "{query}"
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => executeResult(result)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors focus-ring",
                    selectedIndex === index
                      ? "bg-background-hover border border-border"
                      : "hover:bg-background-hover/50 border border-transparent"
                  )}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="w-8 h-8 rounded-lg bg-background-elevated border border-border flex items-center justify-center text-foreground-subtle shrink-0">
                    {result.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">{result.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-background-elevated text-foreground-subtle border border-border">
                        {result.type}
                      </span>
                    </div>
                    <p className="text-xs text-foreground-subtle truncate">{result.subtitle}</p>
                  </div>
                  {selectedIndex === index && <CornerDownLeft className="w-4 h-4 text-foreground-subtle" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-foreground-subtle">
          <span className="flex items-center gap-1"><kbd className="px-1 bg-background-elevated border border-border rounded">↑↓</kbd> Navigate</span>
          <span className="flex items-center gap-1"><kbd className="px-1 bg-background-elevated border border-border rounded">Enter</kbd> Select</span>
          <span className="flex items-center gap-1"><kbd className="px-1 bg-background-elevated border border-border rounded">Esc</kbd> Close</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
