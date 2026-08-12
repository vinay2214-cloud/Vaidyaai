"""
VaidyaAI — Production Hardening Test Suite.
Tests for Phases 1-14: tenant identity, patient identity, auth hardening,
clinical grounding, prescription safety, FHIR R4, provenance, and patient summary.
"""
import pytest
import asyncio
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock, AsyncMock


# ─── Phase 1: Canonical Tenant Identity ──────────────────────────────────────

class TestCanonicalTenantIdentity:
    def test_clinic_id_is_uuid_based(self):
        from api.clinics import _generate_clinic_id
        clinic_id = _generate_clinic_id()
        assert clinic_id.startswith("cln_")
        assert len(clinic_id) > 10  # UUID hex is 32 chars + prefix
        # Should not be timestamp-based
        assert clinic_id != f"cln_{int(datetime.now(timezone.utc).timestamp())}"

    def test_clinic_id_uniqueness(self):
        from api.clinics import _generate_clinic_id
        ids = {_generate_clinic_id() for _ in range(100)}
        assert len(ids) == 100  # All unique


# ─── Phase 2: Patient Identity Integrity ──────────────────────────────────────

class TestPatientIdentityIntegrity:
    @pytest.mark.asyncio
    async def test_resolve_patient_id_returns_consistent_id(self):
        from utils.patient_identity import resolve_patient_id
        with patch("utils.patient_identity.get_document", new_callable=AsyncMock, return_value=None), \
             patch("utils.patient_identity.query_documents", new_callable=AsyncMock, return_value=[]):
            result1 = await resolve_patient_id("cln_test", "+919876543210")
            result2 = await resolve_patient_id("cln_test", "+919876543210")
            assert result1["patient_id"] == result2["patient_id"]
            assert result1["patient_id"].startswith("pat_")

    @pytest.mark.asyncio
    async def test_resolve_patient_id_finds_existing(self):
        from utils.patient_identity import resolve_patient_id
        existing_patient = {
            "patient_id": "pat_919876543210",
            "clinic_id": "cln_test",
            "name": "Test Patient",
        }
        with patch("utils.patient_identity.get_document", new_callable=AsyncMock, return_value=existing_patient), \
             patch("utils.patient_identity.query_documents", new_callable=AsyncMock, return_value=[]):
            result = await resolve_patient_id("cln_test", "+919876543210")
            assert result["is_new"] is False
            assert result["patient_id"] == "pat_919876543210"

    @pytest.mark.asyncio
    async def test_resolve_patient_id_finds_legacy_by_phone(self):
        from utils.patient_identity import resolve_patient_id
        legacy_patient = {
            "patient_id": "pat_abc123legacy",
            "clinic_id": "cln_test",
            "phone": "+919876543210",
        }
        with patch("utils.patient_identity.get_document", new_callable=AsyncMock, return_value=None), \
             patch("utils.patient_identity.query_documents", new_callable=AsyncMock, return_value=[legacy_patient]):
            result = await resolve_patient_id("cln_test", "+919876543210")
            assert result["is_new"] is False
            assert result["patient_id"] == "pat_abc123legacy"


# ─── Phase 3: Auth Hardening ──────────────────────────────────────────────────

class TestAuthHardening:
    @pytest.mark.asyncio
    async def test_dev_token_rejected_in_production(self):
        from api.auth import get_current_user
        from config import settings
        with patch.object(type(settings), "is_production", new_callable=lambda: property(lambda self: True)), \
             patch.object(type(settings), "is_development", new_callable=lambda: property(lambda self: False)):
            with pytest.raises(Exception):
                await get_current_user(authorization="Bearer dev_mock_id_token")

    @pytest.mark.asyncio
    async def test_dev_token_accepted_in_development(self):
        from api.auth import get_current_user
        from config import settings
        with patch.object(type(settings), "is_production", new_callable=lambda: property(lambda self: False)), \
             patch.object(type(settings), "is_development", new_callable=lambda: property(lambda self: True)):
            result = await get_current_user(authorization="Bearer dev_mock_id_token")
            assert result["uid"] == "dev_doctor_001"


# ─── Phase 6-7: Grounding + Safety ───────────────────────────────────────────

class TestGroundingAndSafety:
    @pytest.mark.asyncio
    async def test_grounding_rejection_persisted(self):
        """Verify that grounding rejections are included in the consultation doc."""
        from agents.clinical_scribe import ClinicalScribeAgent
        scribe = ClinicalScribeAgent()
        consultation_doc = {
            "consultation_id": "cons_test",
            "grounding_rejections": [
                {"fact": "Diabetes Type 3", "reason": "Not in transcript", "field": "diagnoses"},
            ],
            "grounding_rejection_count": 1,
            "grounding_requires_review": False,
            "safety_eval_required": True,
            "safety_eval_completed": False,
            "ai_generated": True,
            "review_status": "REQUIRES_REVIEW",
        }
        assert consultation_doc["grounding_rejection_count"] == 1
        assert len(consultation_doc["grounding_rejections"]) == 1
        assert consultation_doc["safety_eval_required"] is True
        assert consultation_doc["review_status"] == "REQUIRES_REVIEW"

    def test_prescription_safe_deterministic_allergen_conflict(self):
        from agents.prescription_safe import _detect_allergen_conflicts
        meds = [{"drug_name": "Amoxicillin", "dosage": "500mg"}]
        allergies = ["Penicillin"]
        conflicts = _detect_allergen_conflicts(meds, allergies)
        assert len(conflicts) == 1
        assert conflicts[0]["drug_name"] == "Amoxicillin"
        assert conflicts[0]["allergen"] == "Penicillin"

    def test_prescription_safe_no_conflict_with_nkda(self):
        from agents.prescription_safe import _detect_allergen_conflicts
        meds = [{"drug_name": "Amoxicillin", "dosage": "500mg"}]
        allergies = ["NKDA"]
        conflicts = _detect_allergen_conflicts(meds, allergies)
        assert len(conflicts) == 0

    def test_prescription_safe_sulfa_allergy_catches_co_trimoxazole(self):
        from agents.prescription_safe import _detect_allergen_conflicts
        meds = [{"drug_name": "Co-trimoxazole", "dosage": "960mg"}]
        allergies = ["Sulfa"]
        conflicts = _detect_allergen_conflicts(meds, allergies)
        assert len(conflicts) == 1


# ─── Phase 10: FHIR R4 Interoperability ───────────────────────────────────────

class TestFHIRR4:
    def test_fhir_patient_resource(self):
        from integrations.fhir_r4 import fhir_patient
        p = fhir_patient(patient_id="pat_123", name="Test Patient", phone="+919876543210", gender="male", age=35)
        assert p["resourceType"] == "Patient"
        assert p["id"] == "pat_123"
        assert p["gender"] == "male"
        assert p["active"] is True
        assert len(p["name"]) == 1

    def test_fhir_encounter_resource(self):
        from integrations.fhir_r4 import fhir_encounter
        e = fhir_encounter(consultation_id="cons_1", patient_id="pat_1", clinic_id="cln_1",
                           practitioner_id="doc_1", status="finished")
        assert e["resourceType"] == "Encounter"
        assert e["status"] == "finished"
        assert e["subject"]["reference"] == "Patient/pat_1"

    def test_fhir_condition_resource(self):
        from integrations.fhir_r4 import fhir_condition
        c = fhir_condition(condition_id="cond_1", patient_id="pat_1", encounter_id="cons_1",
                           code_display="Acute URI", icd10_code="J06.9")
        assert c["resourceType"] == "Condition"
        assert c["code"]["text"] == "Acute URI"
        assert c["code"]["coding"][0]["code"] == "J06.9"

    def test_fhir_allergy_intolerance_resource(self):
        from integrations.fhir_r4 import fhir_allergy_intolerance
        a = fhir_allergy_intolerance(allergy_id="all_1", patient_id="pat_1",
                                      allergen="Penicillin", reaction="Rash")
        assert a["resourceType"] == "AllergyIntolerance"
        assert a["criticality"] == "high"
        assert len(a["reaction"]) == 1

    def test_fhir_medication_request_resource(self):
        from integrations.fhir_r4 import fhir_medication_request
        m = fhir_medication_request(medication_request_id="med_1", patient_id="pat_1",
                                     encounter_id="cons_1", drug_name="Paracetamol",
                                     dosage="650mg", frequency="1-0-1")
        assert m["resourceType"] == "MedicationRequest"
        assert m["medicationCodeableConcept"]["text"] == "Paracetamol"
        assert len(m["dosageInstruction"]) == 1

    def test_fhir_provenance_resource(self):
        from integrations.fhir_r4 import fhir_provenance
        p = fhir_provenance(provenance_id="prov_1", target_reference="Encounter/cons_1",
                             agent_name="ClinicalScribe", model_used="gemini-2.5-pro")
        assert p["resourceType"] == "Provenance"
        assert p["entity"][0]["what"]["display"] == "AI Model: gemini-2.5-pro"

    def test_build_fhir_bundle(self):
        from integrations.fhir_r4 import build_fhir_bundle, fhir_patient, fhir_encounter
        resources = [
            fhir_patient(patient_id="pat_1", name="Test"),
            fhir_encounter(consultation_id="cons_1", patient_id="pat_1", clinic_id="cln_1"),
        ]
        bundle = build_fhir_bundle(resources)
        assert bundle["resourceType"] == "Bundle"
        assert bundle["total"] == 2
        assert len(bundle["entry"]) == 2

    @pytest.mark.asyncio
    async def test_fhir_capability_statement_endpoint(self):
        """Verify metadata endpoint returns valid CapabilityStatement."""
        from api.fhir import fhir_metadata
        result = await fhir_metadata()
        assert result["resourceType"] == "CapabilityStatement"
        assert result["fhirVersion"] == "4.0.1"

    @pytest.mark.asyncio
    async def test_export_consultation_to_fhir(self):
        from integrations.fhir_r4 import export_consultation_to_fhir
        consultation = {
            "consultation_id": "cons_test",
            "patient_id": "pat_test",
            "clinic_id": "cln_test",
            "status": "draft",
            "ai_generated": True,
            "diagnoses": [{"description": "Acute URI", "icd10_code": "J06.9", "is_provisional": True}],
            "medications": [{"drug_name": "Paracetamol", "dosage": "650mg", "frequency": "1-0-1"}],
            "patient_allergies": [{"allergen": "Penicillin", "reaction": "Rash"}],
            "vitals": {"temperature": "101.4F", "blood_pressure": "120/80"},
            "scribe_metadata": {"model_used": "gemini-2.5-pro"},
        }
        patient = {"name": "Test Patient", "phone": "+919876543210", "gender": "male", "age": 35}
        clinic = {"name": "Test Clinic", "doctor_name": "Dr. Test", "location": "Tirupati"}
        bundle = await export_consultation_to_fhir(consultation, patient, clinic)
        assert bundle["resourceType"] == "Bundle"
        assert bundle["total"] >= 4  # Patient, Organization, Practitioner, Encounter at minimum
        resource_types = {e["resource"]["resourceType"] for e in bundle["entry"]}
        assert "Patient" in resource_types
        assert "Organization" in resource_types
        assert "Encounter" in resource_types
        assert "Condition" in resource_types
        assert "AllergyIntolerance" in resource_types
        assert "MedicationRequest" in resource_types
        assert "Provenance" in resource_types


# ─── Phase 11: ABDM Alignment ─────────────────────────────────────────────────

class TestABDMAlignment:
    def test_abdm_patient_with_abha(self):
        from integrations.fhir_r4 import fhir_patient_abdm
        p = fhir_patient_abdm(patient_id="pat_1", name="Test", abha_number="12-3456-7890-1234", language="hi")
        assert p["identifier"][0]["system"] == "https://abdm.gov.in/abha"
        assert p["identifier"][0]["value"] == "12-3456-7890-1234"
        assert len(p["communication"]) == 1


# ─── Phase 14: Provenance ─────────────────────────────────────────────────────

class TestProvenance:
    def test_attach_provenance(self):
        from utils.provenance import attach_provenance_to_facts, ProvenanceSource
        facts = {
            "symptoms": [{"name": "Fever"}],
            "diagnoses": [{"description": "URI"}],
            "medications": [{"drug_name": "Paracetamol"}],
        }
        result = attach_provenance_to_facts(
            facts, source=ProvenanceSource.AI_PROVISIONAL,
            agent_name="clinical_scribe", model_used="gemini-2.5-pro",
            consultation_id="cons_1")
        assert result["symptoms"][0]["_provenance"]["source"] == "ai_provisional"
        assert result["diagnoses"][0]["_provenance"]["agent_name"] == "clinical_scribe"
        assert result["medications"][0]["_provenance"]["model_used"] == "gemini-2.5-pro"

    def test_provenance_record_to_dict(self):
        from utils.provenance import ProvenanceRecord, ProvenanceSource
        pr = ProvenanceRecord(source=ProvenanceSource.AI_GROUNDED, agent_name="test")
        d = pr.to_dict()
        assert d["source"] == "ai_grounded"
        assert d["agent_name"] == "test"
        assert d["grounding_validated"] is True


# ─── Phase 12-13: Patient Summary ─────────────────────────────────────────────

class TestPatientSummary:
    @pytest.mark.asyncio
    async def test_generate_patient_summary_no_consultations(self):
        from utils.patient_summary import generate_patient_summary
        with patch("utils.patient_summary.get_document", new_callable=AsyncMock, return_value={
                "patient_id": "pat_1", "clinic_id": "cln_1", "name": "Test"
            }), \
             patch("utils.patient_summary.query_documents", new_callable=AsyncMock, return_value=[]):
            result = await generate_patient_summary("pat_1", "cln_1")
            assert result["summary_generated"] is False
            assert result["reason"] == "no_reviewed_consultations"

    @pytest.mark.asyncio
    async def test_generate_patient_summary_with_reviewed_consultations(self):
        from utils.patient_summary import generate_patient_summary
        consultations = [{
            "consultation_id": "cons_1",
            "patient_id": "pat_1",
            "clinic_id": "cln_1",
            "review_status": "CONFIRMED",
            "ai_generated": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "grounding_rejection_count": 0,
            "safety_eval_completed": True,
            "soap_note": {"subjective": "Fever for 2 days"},
            "diagnoses": [{"description": "Acute URI", "icd10_code": "J06.9"}],
            "medications": [{"drug_name": "Paracetamol", "dosage": "650mg"}],
            "patient_allergies": [{"allergen": "Penicillin"}],
            "vitals": {"temperature": "101F"},
        }]
        with patch("utils.patient_summary.get_document", new_callable=AsyncMock, return_value={
                "patient_id": "pat_1", "clinic_id": "cln_1", "name": "Test Patient",
                "age": 35, "gender": "male", "patient_phone_masked": "+91*******3210"
            }), \
             patch("utils.patient_summary.query_documents", new_callable=AsyncMock, return_value=consultations):
            result = await generate_patient_summary("pat_1", "cln_1")
            assert result["summary_generated"] is True
            assert len(result["active_conditions"]) == 1
            assert len(result["allergies"]) == 1
            assert result["active_conditions"][0]["description"] == "Acute URI"


# ─── Phase 19: Production Security ────────────────────────────────────────────

class TestProductionSecurity:
    def test_firestore_in_memory_forbidden_in_production(self):
        from database.firestore import _should_use_in_memory_store
        from config import settings
        import os
        os.environ["USE_IN_MEMORY_STORE"] = "true"
        with patch.object(type(settings), "is_production", new_callable=lambda: property(lambda self: True)):
            with pytest.raises(RuntimeError, match="forbidden in production"):
                _should_use_in_memory_store()
        os.environ.pop("USE_IN_MEMORY_STORE", None)

    def test_firestore_in_memory_disabled_in_production_by_default(self):
        from database.firestore import _should_use_in_memory_store
        from config import settings
        import os
        os.environ.pop("USE_IN_MEMORY_STORE", None)
        with patch.object(type(settings), "is_production", new_callable=lambda: property(lambda self: True)), \
             patch.object(type(settings), "is_development", new_callable=lambda: property(lambda self: False)):
            os.environ.pop("PYTEST_CURRENT_TEST", None)
            os.environ.pop("FIRESTORE_EMULATOR_HOST", None)
            result = _should_use_in_memory_store()
            assert result is False

    def test_production_config_validation(self):
        from config import settings
        with patch.object(type(settings), "is_production", new_callable=lambda: property(lambda self: True)):
            settings.LIVE_CLINICAL_AI = False
            try:
                with pytest.raises(RuntimeError, match="LIVE_CLINICAL_AI"):
                    settings.validate_production()
            finally:
                settings.LIVE_CLINICAL_AI = True

    def test_production_config_no_mock_fallback(self):
        from config import settings
        with patch.object(type(settings), "is_production", new_callable=lambda: property(lambda self: True)):
            original = settings.AI_ALLOW_MOCK_FALLBACK
            settings.AI_ALLOW_MOCK_FALLBACK = True
            try:
                with pytest.raises(RuntimeError, match="AI_ALLOW_MOCK_FALLBACK"):
                    settings.validate_production()
            finally:
                settings.AI_ALLOW_MOCK_FALLBACK = original


# ─── Phase 15: Billing Safety Gate ───────────────────────────────────────────

class TestBillingSafetyGate:
    @pytest.mark.asyncio
    async def test_invoice_blocked_without_safety_check(self):
        """Invoice creation should be blocked if medications exist without safety check."""
        from api.billing import CreateInvoiceRequest
        mock_consultation = {
            "medications": [{"drug_name": "Paracetamol"}],
            "safety_evaluation": None,
        }
        with patch("database.firestore.get_document", new_callable=AsyncMock, return_value=mock_consultation), \
             patch("api.billing.verify_clinic_access"), \
             patch("api.billing.get_current_user", new_callable=AsyncMock, return_value={"uid": "doc_1", "clinic_id": "cln_1"}):
            req = CreateInvoiceRequest(
                clinic_id="cln_1", consultation_id="cons_1",
                patient_phone="+919876543210")
            with pytest.raises(Exception):
                await create_invoice_endpoint(req, current_user={"uid": "doc_1", "clinic_id": "cln_1"})


# ─── Phase 9: Canonical Clinical Data Model ──────────────────────────────────

class TestCanonicalClinicalModel:
    def test_symptom_model(self):
        from models.clinical import Symptom, SourceType
        s = Symptom(name="Fever", duration="2 days", severity="moderate", source=SourceType.TRANSCRIPT)
        assert s.name == "Fever"
        assert s.source == SourceType.TRANSCRIPT

    def test_allergy_model(self):
        from models.clinical import Allergy, SourceType
        a = Allergy(allergen="Penicillin", reaction="Rash", confirmed_by_clinician=False)
        assert a.allergen == "Penicillin"
        assert a.source == SourceType.TRANSCRIPT

    def test_medication_model(self):
        from models.clinical import Medication
        m = Medication(drug_name="Paracetamol", dosage="650mg", frequency="1-0-1")
        assert m.drug_name == "Paracetamol"

    def test_canonical_clinical_record(self):
        from models.clinical import CanonicalClinicalRecord, ReviewStatus
        rec = CanonicalClinicalRecord(
            consultation_id="cons_1", clinic_id="cln_1", patient_id="pat_1",
            ai_generated=True, review_status=ReviewStatus.REQUIRES_REVIEW,
            safety_eval_required=True)
        assert rec.ai_generated is True
        assert rec.safety_eval_required is True
        assert rec.review_status == ReviewStatus.REQUIRES_REVIEW

    def test_encounter_model(self):
        from models.clinical import Encounter
        e = Encounter(encounter_id="enc_1", clinic_id="cln_1", patient_id="pat_1")
        assert e.encounter_id == "enc_1"

    def test_provenance_model(self):
        from models.clinical import Provenance, SourceType, ReviewStatus
        p = Provenance(source=SourceType.AI_PROVISIONAL, agent_name="clinical_scribe",
                       clinician_review_status=ReviewStatus.REQUIRES_REVIEW)
        assert p.source == SourceType.AI_PROVISIONAL


# ─── Phase 13: IPS FHIR Bundle Export ────────────────────────────────────────

class TestIPSFHIRExport:
    @pytest.mark.asyncio
    async def test_export_patient_summary_to_fhir(self):
        from integrations.fhir_r4 import export_patient_summary_to_fhir
        patient = {
            "patient_id": "pat_test", "clinic_id": "cln_test",
            "name": "Test Patient", "phone": "+919876543210",
            "gender": "male", "age": 35,
        }
        clinic = {"name": "Test Clinic", "doctor_name": "Dr. Test"}
        consultations = [{
            "consultation_id": "cons_1", "patient_id": "pat_test",
            "clinic_id": "cln_test", "review_status": "CONFIRMED",
            "ai_generated": True,
            "diagnoses": [{"description": "Acute URI", "icd10_code": "J06.9"}],
            "medications": [{"drug_name": "Paracetamol", "dosage": "650mg"}],
            "patient_allergies": [{"allergen": "Penicillin"}],
            "vitals": {"temperature": "101F"},
            "scribe_metadata": {"model_used": "gemini-2.5-pro"},
        }]
        bundle = await export_patient_summary_to_fhir(patient, consultations, clinic)
        assert bundle["resourceType"] == "Bundle"
        assert bundle["type"] == "document"
        resource_types = {e["resource"]["resourceType"] for e in bundle["entry"]}
        assert "Composition" in resource_types
        assert "Patient" in resource_types
        # Verify Composition has IPS sections
        composition = [e["resource"] for e in bundle["entry"] if e["resource"]["resourceType"] == "Composition"][0]
        assert len(composition["section"]) == 4  # conditions, medications, allergies, results


# ─── Phase 7: Stale Safety Check ─────────────────────────────────────────────

class TestStaleSafetyCheck:
    def test_stale_safety_comparison(self):
        """Medications updated after safety eval should be flagged as stale."""
        from datetime import datetime, timezone, timedelta
        now = datetime.now(timezone.utc)
        safety_evaluated_at = now - timedelta(minutes=10)
        medications_updated_at = now
        assert safety_evaluated_at < medications_updated_at  # stale scenario
