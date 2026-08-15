"use client";

import { create } from "zustand";

export interface CurrentPatient {
  patient_id: string;
  name?: string;
  allergies?: string[];
  chronic_conditions?: string[];
  risk_level?: string;
}

interface PatientState {
  currentPatient: CurrentPatient | null;
  setCurrentPatient: (p: CurrentPatient | null) => void;
  /**
   * Identity-aware cleanup: clears the current patient ONLY if it still belongs
   * to the given patient_id. This prevents a slow Patient A unmount from wiping
   * out a Patient B that was already loaded (race-condition safe).
   */
  clearCurrentPatientIf: (patientId: string) => void;
}

export const usePatientStore = create<PatientState>((set, get) => ({
  currentPatient: null,
  setCurrentPatient: (p) => set({ currentPatient: p }),
  clearCurrentPatientIf: (patientId) => {
    const current = get().currentPatient;
    if (current && current.patient_id === patientId) {
      set({ currentPatient: null });
    }
  },
}));
