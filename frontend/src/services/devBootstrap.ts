import { DEV_CLINIC_DATA, DEV_DOCTOR_USER, isDevAuthBypassEnabled } from "../lib/auth";
import api from "../lib/api";

export interface ClinicMapping {
  clinic_id: string;
  doctor_name: string;
  clinic_name: string;
  role: string;
}

/** Sentinel returned when a production user has no resolvable clinic mapping. */
export const NO_CLINIC_MAPPING: ClinicMapping = {
  clinic_id: "",
  doctor_name: "",
  clinic_name: "",
  role: ""
};

export class DevBootstrapService {
  /**
   * Resolve a user's clinic mapping.
   *
   * In development (auth bypass enabled) this may provision the dev clinic via
   * the dev-only endpoint. In production it NEVER fabricates a clinic mapping:
   * if the authenticated user has no clinic_users/{uid} record, it returns
   * NO_CLINIC_MAPPING so the UI can surface a real authorization error instead
   * of silently granting access to the development clinic.
   */
  public static async ensureClinicMapping(
    uid: string = DEV_DOCTOR_USER.uid,
    clinicId: string = DEV_CLINIC_DATA.clinicId,
    doctorName: string = DEV_CLINIC_DATA.doctorName,
    clinicName: string = DEV_CLINIC_DATA.clinicName,
    role: string = DEV_CLINIC_DATA.role
  ): Promise<ClinicMapping> {
    const devFallback: ClinicMapping = {
      clinic_id: clinicId,
      doctor_name: doctorName,
      clinic_name: clinicName,
      role: role
    };

    // Production / SSR: never fabricate a clinic mapping from dev data.
    if (typeof window === "undefined" || !isDevAuthBypassEnabled()) {
      return NO_CLINIC_MAPPING;
    }

    try {
      const res = await api.post("/clinics/dev-provision", {
        uid: uid,
        clinic_id: clinicId,
        doctor_name: doctorName,
        clinic_name: clinicName,
        role: role
      });

      if (res.data && res.data.clinic_id) {
        return {
          clinic_id: res.data.clinic_id,
          doctor_name: res.data.doctor_name || doctorName,
          clinic_name: res.data.clinic_name || clinicName,
          role: res.data.role || role
        };
      }
    } catch (e: any) {
      console.warn("[DevBootstrapService] Dev provision endpoint warning:", e?.message || e);
    }

    return devFallback;
  }
}
