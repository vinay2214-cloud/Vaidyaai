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
}

export const usePatientStore = create<PatientState>((set) => ({
  currentPatient: null,
  setCurrentPatient: (p) => set({ currentPatient: p }),
}));
