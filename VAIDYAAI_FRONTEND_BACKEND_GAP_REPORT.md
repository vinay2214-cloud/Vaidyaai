# VaidyaAI — Frontend ↔ Backend Forensic Gap Analysis Report

**Audit Date:** August 13, 2026  
**Auditor:** Senior Principal Clinical Informatics & QA Lead  
**Repository:** `vinay2214-cloud/Vaidyaai`  

---

## Capability Matrix & Integration Audit

| Capability Area | Implemented Backend? | API Route Available? | Frontend Action Available? | Frontend Screen Available? | Integration Working? | Browser Tested? | Priority / Action Needed |
|---|---|---|---|---|---|---|---|
| **FHIR R4 Patient Export** | YES (`integrations/fhir_r4.py`) | YES (`GET /fhir/Patient/{id}`) | NO (Missing action) | NO (No download/preview modal) | PARTIAL | NO | **P1** — Add "Export FHIR R4" modal on Patient Profile. |
| **FHIR R4 Encounter Export** | YES (`integrations/fhir_r4.py`) | YES (`GET /consultations/{id}/fhir`) | NO (Missing action) | NO (No download modal) | PARTIAL | NO | **P1** — Add "Export FHIR R4" button in Consultation Workspace. |
| **Longitudinal Patient Summary** | YES (`utils/patient_summary.py`) | YES (`GET /consultations/patient-summary/{id}`) | PARTIAL (Toast only) | PARTIAL (Static fallback) | PARTIAL | NO | **P1** — Connect live API to `AISummaryCard` and provide export. |
| **Prescription PDF Generation** | YES (`services/pdf_generator.py`) | YES (`GET /consultations/{id}/pdf`) | YES (in consult) | NO (in QuickActionsBar alert) | PARTIAL | YES | **P2** — Connect Print Rx in `QuickActionsBar` to direct PDF download. |
| **Patient Registration UUID Suffix** | YES (`api/patients.py`) | YES (`POST /patients/register`) | YES (`WalkInModal.tsx`) | YES (Header modal) | BROKEN (Missing `uuid` import) | NO | **P0** — Fix `import uuid` in `backend/api/patients.py`. |
| **Agent Activity & Provenance Feed** | YES (`api/consultations.py`) | YES (`GET /consultations/{id}/activity`) | PARTIAL | YES (Right sidebar) | PARTIAL | YES | **P2** — Ensure 7 clinician-friendly agent cards with live logs. |
| **PrescriptionSafe Hard-Stop** | YES (`agents/prescription_safe.py`) | YES (`POST /consultations/{id}/safety-check`) | YES (`SOAPNoteEditor.tsx`) | YES (Allergen banner) | YES | YES | **P0 (Verified)** — Maintain 100% fail-closed safety gate. |
| **BillingPulse Two-Tier Gate** | YES (`agents/billing_pulse.py`) | YES (`POST /billing/create-invoice`) | YES (`billing/page.tsx`) | YES (Invoice table & modal) | YES | YES | **P0 (Verified)** — Ensure reconciliation works across Cash/Card/UPI. |

---

## Categorized Defect Prioritization

### P0 — Clinical Safety, Data Corruption, Security (Immediate Fix)
1. **Missing `import uuid` in `backend/api/patients.py`:** Line 240 causes unhandled `NameError` during walk-in registration.

### P1 — Broken Workflow & Missing Backend Integrations (Immediate Fix)
1. **Expose FHIR R4 Export in UI:** Add "Export FHIR R4" modal and download trigger on Patient Profile (`/patients/[id]`) and Consultation Workspace (`/consultation/[id]`).
2. **Expose Longitudinal Patient Summary:** Connect `AISummaryCard` to `/api/v1/consultations/patient-summary/{patient_id}` with live refresh and download capabilities.

### P2 — Major Usability & Polish (Immediate Fix)
1. **Replace QuickActionsBar Placeholders:** Wire "Print Rx" to `/api/v1/consultations/{id}/pdf`, "Create Referral" to referral drawer, and "Create Invoice" to `/billing`.
2. **Clinician-Friendly Agent Activity Area:** Ensure the 7 agents (Appointment Assistant, Clinical Scribe, Medication Safety, Billing Assistant, Follow-up Assistant, Referral Assistant, Clinical Insights) are clearly labeled with status, evidence, and human review tags.
