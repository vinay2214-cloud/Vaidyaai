"use client";

import React, { useState, useCallback } from "react";
import { Download, Copy, Check, FileCode, X, Loader2, ShieldCheck } from "lucide-react";
import api from "@/lib/api";

interface FHIRExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId?: string;
  consultationId?: string;
  patientName?: string;
}

export function FHIRExportModal({
  isOpen,
  onClose,
  patientId,
  consultationId,
  patientName = "Patient",
}: FHIRExportModalProps) {
  const [loading, setLoading] = useState(false);
  const [fhirData, setFhirData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchFHIR = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let res;
      if (consultationId) {
        res = await api.get(`/consultations/${consultationId}/fhir`);
      } else if (patientId) {
        res = await api.get(`/fhir/Patient/${patientId}/summary`);
      } else {
        throw new Error("Missing patient or consultation identifier");
      }
      setFhirData(res.data);
    } catch (err: any) {
      console.error("FHIR export error:", err);
      setError(err?.response?.data?.detail || "Could not generate FHIR R4 bundle. Please verify clinical data exists.");
    } finally {
      setLoading(false);
    }
  }, [consultationId, patientId]);

  React.useEffect(() => {
    if (isOpen && !fhirData && !loading) {
      fetchFHIR();
    }
  }, [isOpen, patientId, consultationId, fetchFHIR, fhirData, loading]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!fhirData) return;
    navigator.clipboard.writeText(JSON.stringify(fhirData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!fhirData) return;
    const blob = new Blob([JSON.stringify(fhirData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `FHIR_R4_${consultationId ? `Encounter_${consultationId}` : `Patient_${patientId}`}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const entryCount = fhirData?.entry?.length || 0;
  const resourceTypes = Array.from(
    new Set(fhirData?.entry?.map((e: any) => e.resource?.resourceType).filter(Boolean) || [])
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Export FHIR R4 Bundle
                <span className="px-2 py-0.5 text-[10px] font-mono bg-teal-500/20 text-teal-300 rounded border border-teal-500/30">
                  HL7 FHIR 4.0.1
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                ABDM & IPS compliant international clinical summary for {patientName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
              <p className="text-xs font-medium">Assembling FHIR R4 Bundle from verified clinical records...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex flex-col gap-2">
              <span className="font-bold">FHIR Export Failed</span>
              <span>{error}</span>
              <button
                onClick={fetchFHIR}
                className="self-start px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-lg text-xs font-semibold mt-1"
              >
                Retry Generation
              </button>
            </div>
          )}

          {fhirData && !loading && (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-xs">
                <div>
                  <span className="text-slate-400 block">Bundle Type</span>
                  <span className="text-white font-mono font-bold">{fhirData.type || "document"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Total Resources</span>
                  <span className="text-teal-400 font-mono font-bold">{entryCount} Resources</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Standards Profile</span>
                  <span className="text-emerald-400 font-mono font-bold">IPS / ABDM</span>
                </div>
              </div>

              {/* Resource Tags */}
              {resourceTypes.length > 0 && (
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                    Included FHIR Resources:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {resourceTypes.map((t: any) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-300 rounded text-xs font-mono"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* JSON Preview */}
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Bundle Payload Preview:
                </span>
                <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-mono text-emerald-300 max-h-60 overflow-y-auto scrollbar-thin">
                  {JSON.stringify(fhirData, null, 2)}
                </pre>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <span>FHIR R4 Verified</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={!fhirData || loading}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-40"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy JSON"}
            </button>

            <button
              onClick={handleDownload}
              disabled={!fhirData || loading}
              className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-40 shadow-sm"
            >
              <Download className="w-4 h-4" /> Download FHIR JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
