"""
VaidyaAI — Canonical Clinical Data Model.
Pydantic V2 models providing typed, validated representations of all clinical entities.
These models serve as the controlled source from which UI, SOAP, safety workflows,
FHIR representations, and summaries are derived.
"""
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class SourceType(str, Enum):
    TRANSCRIPT = "transcript"
    CLINICIAN_ENTERED = "clinician_entered"
    PATIENT_RECORD = "patient_record"
    AI_PROVISIONAL = "ai_provisional"


class ReviewStatus(str, Enum):
    REQUIRES_REVIEW = "REQUIRES_REVIEW"
    PROVISIONAL = "PROVISIONAL"
    CONFIRMED = "CONFIRMED"
    REJECTED = "REJECTED"


class Provenance(BaseModel):
    source: SourceType
    agent_name: Optional[str] = None
    model_used: Optional[str] = None
    model_version: Optional[str] = None
    evidence: Optional[str] = None
    evidence_span: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)
    validation_result: Optional[str] = None
    clinician_review_status: Optional[ReviewStatus] = None
    approving_clinician: Optional[str] = None


class Symptom(BaseModel):
    name: str
    duration: Optional[str] = None
    severity: Optional[str] = None
    source: SourceType = SourceType.TRANSCRIPT
    evidence: Optional[str] = None
    provenance: Optional[Provenance] = None


class Allergy(BaseModel):
    allergen: str
    reaction: Optional[str] = None
    severity: Optional[str] = None
    source: SourceType = SourceType.TRANSCRIPT
    evidence: Optional[str] = None
    confirmed_by_clinician: bool = False
    provenance: Optional[Provenance] = None


class Medication(BaseModel):
    drug_name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    route: Optional[str] = None
    timing: Optional[str] = None
    effect: Optional[str] = None
    source: SourceType = SourceType.TRANSCRIPT
    evidence: Optional[str] = None
    provenance: Optional[Provenance] = None


class VitalSigns(BaseModel):
    temperature: Optional[str] = None
    blood_pressure: Optional[str] = None
    heart_rate: Optional[str] = None
    spo2: Optional[str] = None
    respiratory_rate: Optional[str] = None
    weight: Optional[str] = None
    source: SourceType = SourceType.TRANSCRIPT
    provenance: Optional[Provenance] = None


class Diagnosis(BaseModel):
    description: str
    icd10_code: Optional[str] = None
    is_provisional: bool = True
    status: ReviewStatus = ReviewStatus.PROVISIONAL
    source: SourceType = SourceType.AI_PROVISIONAL
    evidence: Optional[str] = None
    provenance: Optional[Provenance] = None


class Condition(BaseModel):
    name: str
    status: str = "active"
    clinical_status: Optional[str] = None
    icd10_code: Optional[str] = None
    onset_date: Optional[str] = None
    source: SourceType = SourceType.TRANSCRIPT
    evidence: Optional[str] = None
    provenance: Optional[Provenance] = None


class Procedure(BaseModel):
    name: str
    date: Optional[str] = None
    outcome: Optional[str] = None
    source: SourceType = SourceType.TRANSCRIPT
    provenance: Optional[Provenance] = None


class Referral(BaseModel):
    specialty: str
    reason: Optional[str] = None
    urgency: Optional[str] = None
    status: str = "pending"
    source: SourceType = SourceType.AI_PROVISIONAL
    provenance: Optional[Provenance] = None


class Observation(BaseModel):
    name: str
    value: Optional[str] = None
    unit: Optional[str] = None
    reference_range: Optional[str] = None
    interpretation: Optional[str] = None
    source: SourceType = SourceType.TRANSCRIPT
    provenance: Optional[Provenance] = None


class ClinicalNote(BaseModel):
    note_type: str = "soap"
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None
    ai_generated: bool = True
    review_status: ReviewStatus = ReviewStatus.REQUIRES_REVIEW
    provenance: Optional[Provenance] = None


class Encounter(BaseModel):
    encounter_id: str
    clinic_id: str
    patient_id: str
    practitioner_id: Optional[str] = None
    appointment_id: Optional[str] = None
    status: str = "draft"
    encounter_type: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class CanonicalClinicalRecord(BaseModel):
    """The authoritative clinical record for a patient encounter.
    All clinical facts, safety evaluations, and downstream representations
    (SOAP, FHIR, UI) derive from this model."""
    consultation_id: str
    clinic_id: str
    patient_id: str
    encounter: Optional[Encounter] = None
    symptoms: List[Symptom] = Field(default_factory=list)
    allergies: List[Allergy] = Field(default_factory=list)
    medications: List[Medication] = Field(default_factory=list)
    medications_taken: List[Medication] = Field(default_factory=list)
    vitals: Optional[VitalSigns] = None
    diagnoses: List[Diagnosis] = Field(default_factory=list)
    conditions: List[Condition] = Field(default_factory=list)
    observations: List[Observation] = Field(default_factory=list)
    procedures: List[Procedure] = Field(default_factory=list)
    referrals: List[Referral] = Field(default_factory=list)
    clinical_note: Optional[ClinicalNote] = None
    investigations: List[Dict[str, Any]] = Field(default_factory=list)
    exposures: List[Dict[str, Any]] = Field(default_factory=list)
    negative_findings: List[Dict[str, Any]] = Field(default_factory=list)
    medical_history: List[Dict[str, Any]] = Field(default_factory=list)
    duration: Optional[Dict[str, Any]] = None
    ai_generated: bool = True
    review_status: ReviewStatus = ReviewStatus.REQUIRES_REVIEW
    safety_eval_required: bool = False
    safety_eval_completed: bool = False
    grounding_rejection_count: int = 0
    grounding_requires_review: bool = False
    provenance: Optional[Provenance] = None
