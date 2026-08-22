"""
VaidyaAI — FHIR R4 Interoperability Layer.
Maps validated canonical clinical records to FHIR R4 resources.
Does NOT replace Firestore/PostgreSQL — FHIR is derived from the canonical record.
"""
import uuid
from datetime import datetime, timezone, date
from typing import Dict, Any, List, Optional

FHIR_R4 = "http://hl7.org/fhir/StructureDefinition"
CS_CLINICAL = "http://terminology.hl7.org/CodeSystem/condition-clinical"
CS_VER = "http://terminology.hl7.org/CodeSystem/condition-ver-status"
CS_ALLERGY_CLIN = "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical"
CS_ALLERGY_VER = "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification"
CS_ACTCODE = "http://terminology.hl7.org/CodeSystem/v3-ActCode"
CS_PROV_PART = "http://terminology.hl7.org/CodeSystem/provenance-participant-type"
CS_AUDIT = "http://terminology.hl7.org/CodeSystem/audit-event-type"
SID_ICD10 = "http://hl7.org/fhir/sid/icd-10"
LOINC = "http://loinc.org"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# Each entry lists every key the vitals payload may use, most-canonical first.
#
# The consultation workspace writes vitals as bp / pulse / temp / spo2 / weight /
# resp_rate (see ConsultationWorkspace.tsx). Both exporters previously carried
# their own hardcoded list looking only for blood_pressure / heart_rate /
# temperature, so most recorded observations silently dropped out of every
# bundle produced from a real consultation — well-formed, quietly incomplete.
# Defined once here so the two exporters cannot drift apart again.
VITAL_MAPPINGS = [
    (("temp", "temperature"), "Body temperature", "8310-5"),
    (("bp", "blood_pressure"), "Blood pressure", "85354-9"),
    (("pulse", "heart_rate"), "Heart rate", "8867-4"),
    (("spo2", "oxygen_saturation"), "Oxygen saturation", "2708-6"),
    (("weight", "body_weight"), "Body weight", "29463-7"),
    (("resp_rate", "respiratory_rate"), "Respiratory rate", "9279-1"),
]


def _vital_value(vitals: Any, keys) -> Optional[str]:
    """First present value among the accepted spellings for one vital sign."""
    if not isinstance(vitals, dict):
        return None
    for key in keys:
        if vitals.get(key):
            return vitals[key]
    return None


def _meta(profile: str) -> Dict[str, Any]:
    return {"profile": [f"{FHIR_R4}/{profile}"]}


def fhir_patient(patient_id, name, phone=None, gender=None, age=None, blood_group=None):
    r = {"resourceType": "Patient", "id": patient_id, "meta": _meta("Patient"),
         "identifier": [{"system": "https://vaidya.ai/patients", "value": patient_id}],
         "name": [{"text": name, "use": "official"}], "active": True}
    if phone:
        r["telecom"] = [{"system": "phone", "value": phone, "use": "mobile"}]
    if gender:
        g = gender.lower()
        r["gender"] = "male" if g in ("male", "m") else ("female" if g in ("female", "f") else "other")
    if age is not None:
        r["birthDate"] = f"{date.today().year - age}"
    return r


def fhir_organization(clinic_id, name, phone=None, location=None):
    r = {"resourceType": "Organization", "id": clinic_id, "meta": _meta("Organization"),
         "identifier": [{"system": "https://vaidya.ai/clinics", "value": clinic_id}],
         "name": name, "active": True}
    if phone:
        r["telecom"] = [{"system": "phone", "value": phone}]
    if location:
        r["address"] = [{"text": location, "country": "IN"}]
    return r


def fhir_practitioner(practitioner_id, name, organization_id=None):
    p = {"resourceType": "Practitioner", "id": practitioner_id, "meta": _meta("Practitioner"),
         "identifier": [{"system": "https://vaidya.ai/practitioners", "value": practitioner_id}],
         "name": [{"text": name, "use": "official"}], "active": True}
    role = None
    if organization_id:
        role = {"resourceType": "PractitionerRole", "id": f"role_{practitioner_id}",
                "meta": _meta("PractitionerRole"),
                "practitioner": {"reference": f"Practitioner/{practitioner_id}"},
                "organization": {"reference": f"Organization/{organization_id}"}, "active": True}
    return p, role


def fhir_encounter(consultation_id, patient_id, clinic_id, practitioner_id=None,
                   appointment_id=None, status="finished", encounter_type="ambulatory",
                   start_time=None, end_time=None):
    r = {"resourceType": "Encounter", "id": consultation_id, "meta": _meta("Encounter"),
         "status": status, "class": {"system": CS_ACTCODE, "code": encounter_type},
         "subject": {"reference": f"Patient/{patient_id}"},
         "identifier": [{"system": "https://vaidya.ai/consultations", "value": consultation_id}]}
    if practitioner_id:
        r["participant"] = [{"individual": {"reference": f"Practitioner/{practitioner_id}"}}]
    if appointment_id:
        r["appointment"] = [{"reference": f"Appointment/{appointment_id}"}]
    if start_time:
        r["period"] = {"start": str(start_time)}
        if end_time:
            r["period"]["end"] = str(end_time)
    return r


def fhir_condition(condition_id, patient_id, encounter_id, code_display,
                   icd10_code=None, clinical_status="active", verification_status="unconfirmed"):
    r = {"resourceType": "Condition", "id": condition_id, "meta": _meta("Condition"),
         "clinicalStatus": {"coding": [{"system": CS_CLINICAL, "code": clinical_status}]},
         "verificationStatus": {"coding": [{"system": CS_VER, "code": verification_status}]},
         "subject": {"reference": f"Patient/{patient_id}"},
         "encounter": {"reference": f"Encounter/{encounter_id}"}, "code": {"text": code_display}}
    if icd10_code:
        r["code"]["coding"] = [{"system": SID_ICD10, "code": icd10_code, "display": code_display}]
    return r


def fhir_observation(observation_id, patient_id, encounter_id, code_display,
                     value=None, value_quantity=None, loinc_code=None):
    r = {"resourceType": "Observation", "id": observation_id, "meta": _meta("Observation"),
         "status": "final", "subject": {"reference": f"Patient/{patient_id}"},
         "encounter": {"reference": f"Encounter/{encounter_id}"},
         "code": {"text": code_display}, "effectiveDateTime": _now_iso()}
    if loinc_code:
        r["code"]["coding"] = [{"system": LOINC, "code": loinc_code, "display": code_display}]
    if value_quantity:
        r["valueQuantity"] = value_quantity
    elif value:
        r["valueString"] = str(value)
    return r


def fhir_allergy_intolerance(allergy_id, patient_id, allergen, reaction=None,
                             clinical_status="active", verification_status="unconfirmed"):
    r = {"resourceType": "AllergyIntolerance", "id": allergy_id, "meta": _meta("AllergyIntolerance"),
         "clinicalStatus": {"coding": [{"system": CS_ALLERGY_CLIN, "code": clinical_status}]},
         "verificationStatus": {"coding": [{"system": CS_ALLERGY_VER, "code": verification_status}]},
         "type": "allergy", "category": ["medication"], "criticality": "high",
         "code": {"text": allergen}, "patient": {"reference": f"Patient/{patient_id}"}}
    if reaction:
        r["reaction"] = [{"manifestation": [{"text": reaction}]}]
    return r


def _iter_patient_allergies(patient, consultation=None):
    """
    Yield (allergen, reaction) pairs for a patient, deduplicated by allergen name.

    The patient document's `allergies` field is the canonical source of a
    patient's known allergies. A consultation may additionally carry
    `patient_allergies` (the allergy context captured at the time of the
    encounter). Both are included so the FHIR export never omits a documented
    allergy, while duplicates across the two sources are collapsed.
    """
    seen = set()
    sources = []
    if consultation:
        sources.extend(consultation.get("patient_allergies", []) or [])
    sources.extend(patient.get("allergies", []) or [])
    for allergy in sources:
        if isinstance(allergy, dict):
            allergen = allergy.get("allergen", "")
            reaction = allergy.get("reaction")
        else:
            allergen = str(allergy)
            reaction = None
        if not allergen:
            continue
        key = allergen.strip().lower()
        if key in seen:
            continue
        seen.add(key)
        yield allergen, reaction


def fhir_medication_request(medication_request_id, patient_id, encounter_id, drug_name,
                            dosage=None, frequency=None, route=None, authored_on=None):
    r = {"resourceType": "MedicationRequest", "id": medication_request_id,
         "meta": _meta("MedicationRequest"), "status": "active", "intent": "order",
         "subject": {"reference": f"Patient/{patient_id}"},
         "encounter": {"reference": f"Encounter/{encounter_id}"},
         "medicationCodeableConcept": {"text": drug_name}, "authoredOn": authored_on or _now_iso()}
    di = {}
    if dosage:
        di["text"] = dosage
    if frequency:
        di["text"] = f"{di.get('text', '')} {frequency}".strip()
    if route:
        di["route"] = {"text": route}
    if di:
        r["dosageInstruction"] = [di]
    return r


def fhir_service_request(service_request_id, patient_id, encounter_id, specialty, reason=None):
    r = {"resourceType": "ServiceRequest", "id": service_request_id,
         "meta": _meta("ServiceRequest"), "status": "active", "intent": "order",
         "subject": {"reference": f"Patient/{patient_id}"},
         "encounter": {"reference": f"Encounter/{encounter_id}"}, "code": {"text": specialty}}
    if reason:
        r["reasonCode"] = [{"text": reason}]
    return r


def fhir_provenance(provenance_id, target_reference, agent_name, agent_type="author",
                    recorded=None, model_used=None):
    r = {"resourceType": "Provenance", "id": provenance_id, "meta": _meta("Provenance"),
         "target": [{"reference": target_reference}], "recorded": recorded or _now_iso(),
         "agent": [{"type": {"coding": [{"system": CS_PROV_PART, "code": agent_type}]},
                    "who": {"display": agent_name}}]}
    if model_used:
        r["entity"] = [{"role": "source", "what": {"display": f"AI Model: {model_used}"}}]
    return r


def fhir_composition(composition_id, patient_id, author_id, encounter_id=None,
                     title="Patient Summary", sections=None):
    r = {"resourceType": "Composition", "id": composition_id, "meta": _meta("Composition"),
         "status": "preliminary",
         "type": {"coding": [{"system": LOINC, "code": "11502-2", "display": "Laboratory report"}], "text": title},
         "subject": {"reference": f"Patient/{patient_id}"},
         "date": _now_iso(), "author": [{"reference": f"Practitioner/{author_id}"}], "title": title}
    # Composition.encounter is optional (0..1) and must only be set when the
    # referenced Encounter actually exists in the bundle. A longitudinal patient
    # summary spans many encounters, so it carries no single encounter reference.
    if encounter_id:
        r["encounter"] = {"reference": f"Encounter/{encounter_id}"}
    if sections:
        r["section"] = sections
    return r


def fhir_audit_event(audit_id, action, agent_who, entity_reference, subtype=None):
    r = {"resourceType": "AuditEvent", "id": audit_id, "meta": _meta("AuditEvent"),
         "type": {"system": CS_AUDIT, "code": "rest"}, "action": action,
         "recorded": _now_iso(), "outcome": "0",
         "agent": [{"who": {"display": agent_who}, "requestor": True}],
         "source": {"observer": {"display": "VaidyaAI"}}, "entity": [{"reference": entity_reference}]}
    if subtype:
        r["subtype"] = [{"code": subtype}]
    return r


def fhir_appointment(appointment_id, patient_id, practitioner_id, status="booked",
                     start=None, end=None, description=None):
    r = {"resourceType": "Appointment", "id": appointment_id, "meta": _meta("Appointment"),
         "status": status,
         "participant": [
             {"actor": {"reference": f"Patient/{patient_id}"}, "status": "accepted"},
             {"actor": {"reference": f"Practitioner/{practitioner_id}"}, "status": "accepted"}]}
    if start:
        r["start"] = start
    if end:
        r["end"] = end
    if description:
        r["description"] = description
    return r


def build_fhir_bundle(resources, bundle_id=None, bundle_type="collection"):
    return {"resourceType": "Bundle",
            "id": bundle_id or f"bundle_{uuid.uuid4().hex[:12]}",
            "meta": {"lastUpdated": _now_iso()}, "type": bundle_type,
            "total": len(resources), "entry": [{"resource": r} for r in resources]}


# ─── ABDM Alignment Annotations ─────────────────────────────────────────────
# ABDM (Ayushman Bharat Digital Mission) uses FHIR R4 as its base format with
# India-specific extensions. Key alignment points:
# 1. Patient.identifier uses ABHA (Ayushman Bharat Health Account) when available
# 2. Organization.identifier uses ABDM facility registry IDs
# 3. All resources include ABDM-compliant meta profiles where applicable
# 4. Language preference mapped to patient.communication
# TODO: When ABHA integration is available, add ABHA number as primary identifier

ABDM_SYSTEMS = {
    "abha": "https://abdm.gov.in/abha",
    "facility": "https://abdm.gov.in/facility",
    "practitioner": "https://abdm.gov.in/practitioner",
}


def fhir_patient_abdm(patient_id, name, phone=None, gender=None, age=None,
                      abha_number=None, language=None):
    """ABDM-aligned Patient resource with ABHA identifier support."""
    r = fhir_patient(patient_id, name, phone=phone, gender=gender, age=age)
    if abha_number:
        r["identifier"].insert(0, {"system": ABDM_SYSTEMS["abha"], "value": abha_number})
    if language:
        r["communication"] = [{"language": {"coding": [{"system": "urn:ietf:bcp:47", "code": language}]}}]
    return r


# ─── Consultation → FHIR Bundle Export ───────────────────────────────────────

async def export_consultation_to_fhir(consultation, patient, clinic):
    """
    Export a complete consultation to a FHIR R4 Bundle.
    Derived from validated canonical clinical record only — does not invent facts.
    """
    resources = []
    patient_id = consultation.get("patient_id", "")
    consultation_id = consultation.get("consultation_id", "")
    clinic_id = consultation.get("clinic_id", "")

    resources.append(fhir_patient(
        patient_id=patient_id, name=patient.get("name", ""),
        phone=patient.get("phone"), gender=patient.get("gender"), age=patient.get("age")))

    resources.append(fhir_organization(
        clinic_id=clinic_id, name=clinic.get("name", ""),
        phone=clinic.get("phone"), location=clinic.get("location")))

    practitioner_id = clinic.get("doctor_name", "unknown").replace(" ", "_").lower()
    practitioner, role = fhir_practitioner(
        practitioner_id=practitioner_id, name=clinic.get("doctor_name", ""),
        organization_id=clinic_id)
    resources.append(practitioner)
    if role:
        resources.append(role)

    appointment_id = consultation.get("appointment_id")
    resources.append(fhir_encounter(
        consultation_id=consultation_id, patient_id=patient_id, clinic_id=clinic_id,
        practitioner_id=practitioner_id, appointment_id=appointment_id,
        status="finished" if consultation.get("status") == "approved" else "in-progress",
        start_time=str(consultation.get("created_at", "")),
        end_time=str(consultation.get("approved_at", "")) if consultation.get("approved_at") else None))

    # The Encounter references Appointment/{appointment_id} when an appointment
    # exists; the referenced Appointment resource MUST be present in the bundle
    # or the export is not a valid FHIR Bundle (broken reference).
    if appointment_id:
        resources.append(fhir_appointment(
            appointment_id=appointment_id, patient_id=patient_id,
            practitioner_id=practitioner_id,
            status="finished" if consultation.get("status") == "approved" else "booked",
            start=str(consultation.get("created_at", "")) or None,
            description=consultation.get("complaint_summary") or consultation.get("chief_complaint")))

    for i, diag in enumerate(consultation.get("diagnoses", [])):
        d = diag if isinstance(diag, dict) else {"description": str(diag)}
        resources.append(fhir_condition(
            condition_id=f"cond_{consultation_id}_{i}", patient_id=patient_id,
            encounter_id=consultation_id, code_display=d.get("description", ""),
            icd10_code=d.get("icd10_code"),
            verification_status="unconfirmed" if d.get("is_provisional", True) else "confirmed"))

    for i, (allergen, reaction) in enumerate(_iter_patient_allergies(patient, consultation)):
        resources.append(fhir_allergy_intolerance(
            allergy_id=f"allergy_{consultation_id}_{i}", patient_id=patient_id,
            allergen=allergen, reaction=reaction))

    for i, med in enumerate(consultation.get("medications", [])):
        m = med if isinstance(med, dict) else {"drug_name": str(med)}
        resources.append(fhir_medication_request(
            medication_request_id=f"medreq_{consultation_id}_{i}", patient_id=patient_id,
            encounter_id=consultation_id, drug_name=m.get("drug_name", ""),
            dosage=m.get("dosage"), frequency=m.get("frequency"), route=m.get("route")))

    vitals = consultation.get("vitals", {}) or {}
    for i, (keys, display, loinc) in enumerate(VITAL_MAPPINGS):
        val = _vital_value(vitals, keys)
        if val:
            resources.append(fhir_observation(
                observation_id=f"obs_{consultation_id}_{i}", patient_id=patient_id,
                encounter_id=consultation_id, code_display=display,
                value=str(val), loinc_code=loinc))

    for i, ref in enumerate(consultation.get("referrals", [])):
        r = ref if isinstance(ref, dict) else {"specialty": str(ref)}
        resources.append(fhir_service_request(
            service_request_id=f"sreq_{consultation_id}_{i}", patient_id=patient_id,
            encounter_id=consultation_id, specialty=r.get("specialty", ""),
            reason=r.get("reason")))

    if consultation.get("ai_generated"):
        resources.append(fhir_provenance(
            provenance_id=f"prov_{consultation_id}",
            target_reference=f"Encounter/{consultation_id}",
            agent_name="ClinicalScribe (Agent 2)",
            model_used=consultation.get("scribe_metadata", {}).get("model_used")))

    return build_fhir_bundle(resources, bundle_id=f"consultation_{consultation_id}",
                             bundle_type="collection")


# ─── Patient Summary / International Patient Summary (IPS) Export ─────────────

async def export_patient_summary_to_fhir(patient, consultations, clinic):
    """
    Export a longitudinal patient summary as a FHIR R4 Bundle with Composition.
    Only includes facts from grounded, clinician-reviewed consultations.
    """
    resources = []
    patient_id = patient.get("patient_id", "")
    clinic_id = patient.get("clinic_id", "")
    practitioner_id = clinic.get("doctor_name", "unknown").replace(" ", "_").lower()

    resources.append(fhir_patient(
        patient_id=patient_id, name=patient.get("name", ""),
        phone=patient.get("phone"), gender=patient.get("gender"), age=patient.get("age")))

    resources.append(fhir_organization(
        clinic_id=clinic_id, name=clinic.get("name", ""),
        phone=clinic.get("phone"), location=clinic.get("location")))

    practitioner, role = fhir_practitioner(
        practitioner_id=practitioner_id, name=clinic.get("doctor_name", ""),
        organization_id=clinic_id)
    resources.append(practitioner)
    if role:
        resources.append(role)

    section_refs = {"conditions": [], "medications": [], "allergies": [], "observations": []}

    # Patient-level allergies are canonical facts on the patient record and must
    # appear in the summary even when no reviewed consultation re-captured them.
    added_allergens = set()
    for i, (allergen, reaction) in enumerate(_iter_patient_allergies(patient)):
        ai = fhir_allergy_intolerance(
            allergy_id=f"allergy_patient_{i}", patient_id=patient_id,
            allergen=allergen, reaction=reaction)
        resources.append(ai)
        section_refs["allergies"].append({"reference": f"AllergyIntolerance/allergy_patient_{i}"})
        added_allergens.add(allergen.strip().lower())

    for consultation in consultations:
        consultation_id = consultation.get("consultation_id", "")
        appointment_id = consultation.get("appointment_id")

        resources.append(fhir_encounter(
            consultation_id=consultation_id, patient_id=patient_id, clinic_id=clinic_id,
            practitioner_id=practitioner_id, appointment_id=appointment_id,
            status="finished" if consultation.get("status") == "approved" else "in-progress",
            start_time=str(consultation.get("created_at", ""))))

        # Keep the Appointment reference resolvable within the bundle.
        if appointment_id:
            resources.append(fhir_appointment(
                appointment_id=appointment_id, patient_id=patient_id,
                practitioner_id=practitioner_id,
                status="finished" if consultation.get("status") == "approved" else "booked",
                start=str(consultation.get("created_at", "")) or None,
                description=consultation.get("complaint_summary") or consultation.get("chief_complaint")))

        for i, diag in enumerate(consultation.get("diagnoses", [])):
            d = diag if isinstance(diag, dict) else {"description": str(diag)}
            cond = fhir_condition(
                condition_id=f"cond_{consultation_id}_{i}", patient_id=patient_id,
                encounter_id=consultation_id, code_display=d.get("description", ""),
                icd10_code=d.get("icd10_code"),
                verification_status="confirmed" if consultation.get("review_status") == "CONFIRMED" else "unconfirmed")
            resources.append(cond)
            section_refs["conditions"].append({"reference": f"Condition/cond_{consultation_id}_{i}"})

        for i, med in enumerate(consultation.get("medications", [])):
            m = med if isinstance(med, dict) else {"drug_name": str(med)}
            mr = fhir_medication_request(
                medication_request_id=f"medreq_{consultation_id}_{i}", patient_id=patient_id,
                encounter_id=consultation_id, drug_name=m.get("drug_name", ""),
                dosage=m.get("dosage"), frequency=m.get("frequency"))
            resources.append(mr)
            section_refs["medications"].append({"reference": f"MedicationRequest/medreq_{consultation_id}_{i}"})

        for i, (allergen, reaction) in enumerate(_iter_patient_allergies({}, consultation)):
            if allergen.strip().lower() in added_allergens:
                continue
            ai = fhir_allergy_intolerance(
                allergy_id=f"allergy_{consultation_id}_{i}", patient_id=patient_id,
                allergen=allergen, reaction=reaction)
            resources.append(ai)
            section_refs["allergies"].append({"reference": f"AllergyIntolerance/allergy_{consultation_id}_{i}"})
            added_allergens.add(allergen.strip().lower())

        # Referrals reach the summary as ServiceRequest resources. The IPS
        # builder previously ignored consultation["referrals"] entirely, so a
        # documented specialist hand-off was absent from the record a receiving
        # clinician would actually be sent.
        for i, ref in enumerate(consultation.get("referrals", [])):
            r = ref if isinstance(ref, dict) else {"specialty": str(ref)}
            sr = fhir_service_request(
                service_request_id=f"svcreq_{consultation_id}_{i}", patient_id=patient_id,
                encounter_id=consultation_id,
                specialty=r.get("specialty") or r.get("speciality", ""),
                reason=r.get("reason") or r.get("reason_for_referral"))
            resources.append(sr)

        vitals = consultation.get("vitals", {}) or {}
        for i, (keys, display, loinc) in enumerate(VITAL_MAPPINGS):
            val = _vital_value(vitals, keys)
            if val:
                obs = fhir_observation(
                    observation_id=f"obs_{consultation_id}_{i}", patient_id=patient_id,
                    encounter_id=consultation_id, code_display=display,
                    value=str(val), loinc_code=loinc)
                resources.append(obs)
                section_refs["observations"].append({"reference": f"Observation/obs_{consultation_id}_{i}"})

        if consultation.get("ai_generated"):
            resources.append(fhir_provenance(
                provenance_id=f"prov_{consultation_id}",
                target_reference=f"Encounter/{consultation_id}",
                agent_name="VaidyaAI ClinicalScribe",
                model_used=consultation.get("scribe_metadata", {}).get("model_used")))

    composition = fhir_composition(
        composition_id=f"summary_{patient_id}",
        patient_id=patient_id,
        author_id=practitioner_id, title="Patient Summary (IPS)",
        sections=[
            {"title": "Active Problems", "code": {"coding": [{"system": LOINC, "code": "11450-4"}]},
             "entry": section_refs["conditions"]},
            {"title": "Medications", "code": {"coding": [{"system": LOINC, "code": "10160-0"}]},
             "entry": section_refs["medications"]},
            {"title": "Allergies", "code": {"coding": [{"system": LOINC, "code": "48765-2"}]},
             "entry": section_refs["allergies"]},
            {"title": "Results", "code": {"coding": [{"system": LOINC, "code": "30954-2"}]},
             "entry": section_refs["observations"]},
        ])
    resources.insert(0, composition)

    return build_fhir_bundle(resources, bundle_id=f"ips_{patient_id}", bundle_type="document")
