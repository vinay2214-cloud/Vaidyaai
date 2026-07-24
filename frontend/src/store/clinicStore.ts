import { create } from "zustand";

interface ClinicState {
  clinicId: string | null;
  doctorName: string | null;
  clinicName: string | null;
  role: string | null;
  setClinic: (clinicId: string, doctorName: string, clinicName: string, role?: string) => void;
  clearClinic: () => void;
}

export const useClinicStore = create<ClinicState>((set) => ({
  clinicId: null,
  doctorName: null,
  clinicName: null,
  role: null,
  setClinic: (clinicId, doctorName, clinicName, role = "doctor") =>
    set({ clinicId, doctorName, clinicName, role }),
  clearClinic: () =>
    set({ clinicId: null, doctorName: null, clinicName: null, role: null })
}));
