import { create } from "zustand";

interface ClinicState {
  clinicId: string | null;
  doctorName: string | null;
  clinicName: string | null;
  role: string | null;
  activeConsultationId: string | null;
  currentPatientId: string | null;
  currentAppointmentId: string | null;
  setClinic: (clinicId: string, doctorName: string, clinicName: string, role?: string) => void;
  setActiveConsultation: (consultationId: string, patientId?: string, appointmentId?: string) => void;
  resetConsultation: () => void;
  clearClinic: () => void;
}

export const useClinicStore = create<ClinicState>((set) => ({
  clinicId: null,
  doctorName: null,
  clinicName: null,
  role: null,
  activeConsultationId: null,
  currentPatientId: null,
  currentAppointmentId: null,
  setClinic: (clinicId, doctorName, clinicName, role = "doctor") =>
    set({ clinicId, doctorName, clinicName, role }),
  setActiveConsultation: (consultationId, patientId = undefined, appointmentId = undefined) =>
    set({
      activeConsultationId: consultationId,
      currentPatientId: patientId || null,
      currentAppointmentId: appointmentId || null,
    }),
  resetConsultation: () =>
    set({
      activeConsultationId: null,
      currentPatientId: null,
      currentAppointmentId: null,
    }),
  clearClinic: () =>
    set({
      clinicId: null,
      doctorName: null,
      clinicName: null,
      role: null,
      activeConsultationId: null,
      currentPatientId: null,
      currentAppointmentId: null,
    }),
}));
