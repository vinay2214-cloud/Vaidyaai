"""
VaidyaAI — Provenance Tracker.
Tracks AI-derived fact provenance for clinical safety, audit, and FHIR Provenance export.
Every clinical fact extracted by AI must carry its source trace.
"""
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from enum import Enum

logger = logging.getLogger("vaidyaai.utils.provenance")


class ProvenanceSource(str, Enum):
    TRANSCRIPT = "transcript"
    CLINICIAN_ENTERED = "clinician_entered"
    PATIENT_RECORD = "patient_record"
    AI_PROVISIONAL = "ai_provisional"
    AI_GROUNDED = "ai_grounded"
    AI_REJECTED = "ai_rejected"


class ProvenanceRecord:
    """Lightweight provenance record attached to clinical facts."""

    def __init__(
        self,
        source: ProvenanceSource,
        agent_name: Optional[str] = None,
        model_used: Optional[str] = None,
        evidence: Optional[str] = None,
        evidence_span: Optional[str] = None,
        consultation_id: Optional[str] = None,
        grounding_validated: bool = False,
        clinician_reviewed: bool = False,
    ):
        self.source = source
        self.agent_name = agent_name
        self.model_used = model_used
        self.evidence = evidence
        self.evidence_span = evidence_span
        self.consultation_id = consultation_id
        self.grounding_validated = grounding_validated or (source in (ProvenanceSource.AI_GROUNDED, ProvenanceSource.CLINICIAN_ENTERED))
        self.clinician_reviewed = clinician_reviewed
        self.timestamp = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source": self.source.value,
            "agent_name": self.agent_name,
            "model_used": self.model_used,
            "evidence": self.evidence,
            "evidence_span": self.evidence_span,
            "consultation_id": self.consultation_id,
            "grounding_validated": self.grounding_validated,
            "clinician_reviewed": self.clinician_reviewed,
            "timestamp": self.timestamp,
        }


def attach_provenance_to_facts(
    clinical_facts: Dict[str, Any],
    source: ProvenanceSource = ProvenanceSource.AI_PROVISIONAL,
    agent_name: str = "clinical_scribe",
    model_used: Optional[str] = None,
    evidence_text: Optional[str] = None,
    consultation_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Attach provenance records to all clinical facts in a structured output.
    This is called after grounding validation to mark facts as grounded or rejected.
    """
    prov = ProvenanceRecord(
        source=source,
        agent_name=agent_name,
        model_used=model_used,
        evidence=evidence_text[:500] if evidence_text else None,
        consultation_id=consultation_id,
        grounding_validated=(source in (ProvenanceSource.AI_GROUNDED, ProvenanceSource.CLINICIAN_ENTERED)),
    )
    provenance_dict = prov.to_dict()

    for fact_list_key in ("symptoms", "diagnoses", "medications", "allergies", "vitals",
                          "investigations", "referrals", "observations", "conditions"):
        facts = clinical_facts.get(fact_list_key)
        if isinstance(facts, list):
            for fact in facts:
                if isinstance(fact, dict) and "_provenance" not in fact:
                    fact["_provenance"] = provenance_dict
        elif isinstance(facts, dict) and "_provenance" not in facts:
            facts["_provenance"] = provenance_dict

    if isinstance(clinical_facts, dict) and "_provenance" not in clinical_facts:
        clinical_facts["_provenance"] = provenance_dict

    return clinical_facts


def mark_fact_grounded(clinical_facts: Dict[str, Any], fact_key: str, fact_index: int) -> None:
    """Mark a specific fact as grounded by the GroundingValidator."""
    facts = clinical_facts.get(fact_key)
    if isinstance(facts, list) and fact_index < len(facts):
        fact = facts[fact_index]
        if isinstance(fact, dict) and "_provenance" in fact:
            fact["_provenance"]["grounding_validated"] = True
            fact["_provenance"]["source"] = ProvenanceSource.AI_GROUNDED.value


def mark_fact_rejected(clinical_facts: Dict[str, Any], fact_key: str, fact_index: int) -> None:
    """Mark a specific fact as rejected by the GroundingValidator."""
    facts = clinical_facts.get(fact_key)
    if isinstance(facts, list) and fact_index < len(facts):
        fact = facts[fact_index]
        if isinstance(fact, dict) and "_provenance" in fact:
            fact["_provenance"]["source"] = ProvenanceSource.AI_REJECTED.value
            fact["_provenance"]["grounding_validated"] = False
