import { DEV_CLINIC_DATA, DEV_DOCTOR_USER, isDevAuthBypassEnabled } from "../lib/auth";
import api from "../lib/api";

export interface ClinicMapping {
  clinic_id: string;
  doctor_name: string;
  clinic_name: string;
  role: string;
}

/**
 * Enterprise Development Bootstrap Service.
 * Single Authoritative Source of Provisioning: Delegates all tenant document writes and
 * Firebase Custom Claims synchronization exclusively to the backend POST /clinics/dev-provision API.
 * Eliminates client-side database mutation side-effects to enforce pure backend infrastructure ownership.
 */
export class DevBootstrapService {
  /**
   * Provisions development clinic mapping via the backend provisioning endpoint.
   * Parameterized to support multiple test UIDs, multi-clinic QA personas, and CI pipelines.
   */
  public static async ensureClinicMapping(
    uid: string = DEV_DOCTOR_USER.uid,
    clinicId: string = DEV_CLINIC_DATA.clinicId,
    doctorName: string = DEV_CLINIC_DATA.doctorName,
    clinicName: string = DEV_CLINIC_DATA.clinicName,
    role: string = DEV_CLINIC_DATA.role
  ): Promise<ClinicMapping> {
    const defaultFallback: ClinicMapping = {
      clinic_id: clinicId,
      doctor_name: doctorName,
      clinic_name: clinicName,
      role: role
    };

    if (typeof window === "undefined" || !isDevAuthBypassEnabled()) {
      return defaultFallback;
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
        console.info(`[VaidyaAI DevBootstrapService] Backend provisioned tenant mapping & claims for UID ${uid}.`);
        return {
          clinic_id: res.data.clinic_id,
          doctor_name: res.data.doctor_name || doctorName,
          clinic_name: res.data.clinic_name || clinicName,
          role: res.data.role || role
        };
      }
    } catch (e) {
      console.warn(`[VaidyaAI DevBootstrapService] Backend dev-provision endpoint notice for ${uid}. Using default development mapping.`, e);
    }

    return defaultFallback;
  }
}
