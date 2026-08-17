import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from agents.base_agent import BaseAgent
from prompts.drug_safety import build_drug_safety_prompt
from database.firestore import get_document, update_document
from utils.phi_anonymiser import anonymise_for_llm
from utils.phone_utils import mask_phone

logger = logging.getLogger("vaidyaai.agents.prescription_safe")


# ─── Deterministic allergen-conflict detection ──────────────────────────────────
# Maps common allergen labels used in the UI to the drug-class keywords they
# imply, so that a documented allergy blocks any prescribed drug in that class.
_ALLERGY_CLASS_KEYWORDS: Dict[str, List[str]] = {
    "penicillin": ["penicillin", "amoxicillin", "ampicillin", "amox", "augmentin", "cloxacillin", "flucloxacillin", "piperacillin"],
    "sulfa": ["sulf", "sulpha", "sulfa", "co-trimoxazole", "trimethoprim", "sulfamethoxazole", "glimepir", "glimepiride", "gliclazide", "sulfasalazine"],
    "nsaids": ["ibuprofen", "diclofenac", "aspirin", "naproxen", "ketorolac", "aceclofenac", "mefenamic", "indomethacin", "nimesulide", "etoricoxib", "celecoxib"],
    "aspirin": ["aspirin", "asa", "ecosprin", "disprin"],
    "cephalosporins": ["ceph", "cef", "cefixime", "ceftriaxone", "cefuroxime", "cephalexin", "cefpodoxime"],
    "codeine": ["codeine", "dihydrocodeine"],
    "latex": [],
    "peanuts": [],
    "contrast": ["contrast", "iodinated", "iohexol", "ioversol"],
}

_NKDA_MARKERS = ("no known drug allergies", "nkda", "no known drug allergy", "nil known drug allergies")


def _normalise(s: str) -> str:
    return (s or "").strip().lower()


# Keys under which callers supply a medication's name, in priority order.
_DRUG_NAME_KEYS = ("drug_name", "name", "medication_name", "medication", "drug")


def _drug_name_of(med: Any) -> str:
    """Extract a medication's name regardless of which key the caller used.

    Safety-critical: if the name cannot be read, the deterministic allergy net
    skips the drug entirely, so a penicillin-class prescription could pass an
    allergy check unexamined. Accept every known spelling instead.
    """
    if isinstance(med, str):
        return med
    if not isinstance(med, dict):
        return ""
    for key in _DRUG_NAME_KEYS:
        value = med.get(key)
        if isinstance(value, str) and value.strip():
            return value
    return ""


def _detect_allergen_conflicts(
    medications: List[Dict[str, Any]],
    allergies: List[str],
) -> List[Dict[str, str]]:
    """Return a list of {drug_name, allergen} conflicts.

    NOTE: callers supply medication dicts from several sources (the consultation
    workspace uses ``drug_name``, LLM-generated SOAP plans and API clients often
    use ``name``). Reading only one of those keys made this deterministic net
    silently skip the drug — a fail-OPEN. Use ``_drug_name_of`` instead.

    A conflict is reported when a prescribed drug's name matches a keyword in a
    documented allergy's drug-class. NKDA markers are ignored (they mean *no*
    allergy). This is a deterministic safety net — it must never miss a
    well-known allergen, even if the LLM would (incorrectly) say "safe".
    """
    if not medications or not allergies:
        return []

    # Filter out NKDA-style markers — these mean no allergies are documented.
    real_allergies = [a for a in allergies if _normalise(a) not in _NKDA_MARKERS]
    if not real_allergies:
        return []

    conflicts: List[Dict[str, str]] = []
    for med in medications:
        raw_name = _drug_name_of(med)
        drug_name = _normalise(raw_name)
        if not drug_name:
            continue
        for allergen in real_allergies:
            allergen_norm = _normalise(allergen)
            if allergen_norm in _NKDA_MARKERS:
                continue
            # Direct substring match (e.g. allergy "Penicillin", drug "Amoxicillin")
            if allergen_norm and allergen_norm in drug_name:
                conflicts.append({"drug_name": raw_name, "allergen": allergen})
                continue
            # Class-keyword match (e.g. allergy "Penicillin" -> class keywords)
            class_key = None
            for key in _ALLERGY_CLASS_KEYWORDS:
                if key in allergen_norm:
                    class_key = key
                    break
            if class_key:
                for kw in _ALLERGY_CLASS_KEYWORDS[class_key]:
                    if kw in drug_name:
                        conflicts.append({"drug_name": raw_name, "allergen": allergen})
                        break
    return conflicts


def _medication_signature(medications: List[Dict[str, Any]]) -> str:
    """Canonical, order-independent signature of a medication list.

    Used to detect when the prescription changed after a safety evaluation.
    """
    import json as _json
    parts = []
    for m in medications or []:
        parts.append({
            "drug_name": _normalise(str(_drug_name_of(m))),
            "dosage": _normalise(str(m.get("dosage", ""))),
            "frequency": _normalise(str(m.get("frequency", ""))),
        })
    parts.sort(key=lambda x: (x["drug_name"], x["dosage"], x["frequency"]))
    return _json.dumps(parts, sort_keys=True)


class PrescriptionSafeAgent(BaseAgent):
    """
    Agent 5: PrescriptionSafe
    Autonomous real-time drug interaction checker, allergy conflict validator,
    duplicate therapy detector, and clinical safety auditor.
    """

    def __init__(self):
        super().__init__("prescription_safe")

    async def validate_prescription(
        self,
        consultation_id: str,
        clinic_id: str,
        medications: List[Dict[str, Any]],
        patient_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Validates medication list for interactions, allergy conflicts, and dose safety risks.
        Saves result to Firestore consultation document.
        """
        # Fetch patient background if available
        allergies: List[str] = []
        chronic_conditions: List[str] = []
        age: Optional[int] = None
        gender: Optional[str] = None

        if patient_id:
            patient = await get_document("patients", patient_id)
            if patient:
                allergies = list(patient.get("allergies", []))
                chronic_conditions = list(patient.get("chronic_conditions", []))
                age = patient.get("age")
                gender = patient.get("gender")

        # Also merge allergies documented in current consultation encounter
        if consultation_id:
            cons = await get_document("consultations", consultation_id)
            if cons:
                cons_allergies = cons.get("patient_allergies", [])
                for a in cons_allergies:
                    if a and a not in allergies:
                        allergies.append(a)
                if not chronic_conditions and cons.get("patient_chronic_diseases"):
                    chronic_conditions = list(cons.get("patient_chronic_diseases", []))

        # ─── Deterministic allergen-conflict guard ───────────────────────────────
        # The LLM performs deep pharmacology analysis, but a documented allergen
        # match must NEVER silently pass as safe. This deterministic pre-check
        # guarantees that a known-allergy conflict is flagged regardless of LLM
        # output, and short-circuits to is_safe=False before the model is paid for.
        allergy_conflicts = _detect_allergen_conflicts(medications, allergies)
        if allergy_conflicts:
            from config import settings as _settings
            now_utc = datetime.now(timezone.utc)
            warnings = [
                {
                    "severity": "CRITICAL",
                    "type": "ALLERGY_CONFLICT",
                    "message": (
                        f"Prescribed medication '{c['drug_name']}' conflicts with "
                        f"documented allergy '{c['allergen']}'. Do NOT dispense."
                    ),
                    "drug_name": c["drug_name"],
                    "allergen": c["allergen"],
                }
                for c in allergy_conflicts
            ]
            safety_eval = {
                "is_safe": False,
                "confidence_score": 1.0,
                "warnings_count": len(warnings),
                "warnings": warnings,
                "safety_summary": (
                    f"{len(warnings)} documented allergen conflict(s) detected. "
                    "Prescription blocked — manual review and override required."
                ),
                "risk_level": "CRITICAL",
                "requires_manual_review": True,
                "evaluated_at": now_utc,
                "overridden": False,
                "provider": "deterministic_allergen_guard",
                "model_used": _settings.GEMINI_REASONING_MODEL,
                "region": _settings.GEMINI_REASONING_LOCATION,
                "latency_ms": 0,
                "execution_status": "allergen_blocked",
            }
            await update_document("consultations", consultation_id, {
                "safety_evaluation": safety_eval,
                "safety_eval_completed": True,
                "safety_evaluated_medications": _medication_signature(medications),
                "updated_at": now_utc,
            })
            await self.logger.log_decision(
                decision_type="drug_safety_allergen_blocked",
                decision_made=(
                    f"Deterministic allergen guard BLOCKED {len(medications)} drug(s): "
                    f"{[c['drug_name'] for c in allergy_conflicts]} matched documented allergies."
                ),
                clinic_id=clinic_id,
                consultation_id=consultation_id,
                patient_id=patient_id,
            )
            return safety_eval

        # Build prompt & call Gemini 2.5 Pro for deep clinical pharmacology safety audit
        from config import settings
        prompt = build_drug_safety_prompt(
            medications=medications,
            known_allergies=allergies,
            chronic_conditions=chronic_conditions,
            patient_age=age,
            patient_gender=gender
        )
        # C-7: anonymise any PHI before it leaves for the LLM.
        prompt = anonymise_for_llm(prompt)

        now_utc = datetime.now(timezone.utc)

        # C-4: This is a safety-critical evaluation and MUST fail closed. If the
        # LLM is unavailable or returns an unusable result, do not assume the
        # prescription is safe — flag it for mandatory manual review.
        try:
            safety_res, latency_ms = await self._timed_gemini_json_call(
                task="prescription_safety_check",
                prompt=prompt,
                model=settings.GEMINI_REASONING_MODEL
            )
        except Exception as e:
            logger.error(f"Drug safety evaluation failed; failing closed for consultation {consultation_id}: {e}")
            safety_eval = {
                "is_safe": False,
                "confidence_score": 0.0,
                "warnings_count": 1,
                "warnings": [{
                    "severity": "CRITICAL",
                    "type": "SAFETY_CHECK_FAILED",
                    "message": "Automated drug-safety check unavailable. Manual pharmacist/doctor review required before dispensing."
                }],
                "safety_summary": "Safety check could not be completed automatically. Manual review required.",
                "requires_manual_review": True,
                "evaluated_at": now_utc,
                "overridden": False,
                "provider": "Google Cloud Vertex AI",
                "model_used": settings.GEMINI_REASONING_MODEL,
                "region": settings.GEMINI_REASONING_LOCATION,
                "execution_status": "failed",
                "error_state": str(e)
            }
            await update_document("consultations", consultation_id, {
                "safety_evaluation": safety_eval,
                "safety_eval_completed": True,
                "safety_evaluated_medications": _medication_signature(medications),
                "updated_at": now_utc
            })
            await self.logger.log_decision(
                decision_type="drug_safety_unavailable",
                decision_made=f"Drug safety check failed closed for {len(medications)} drugs. Manual review required.",
                clinic_id=clinic_id,
                consultation_id=consultation_id,
                model_used=settings.GEMINI_REASONING_MODEL
            )
            return safety_eval

        # Fail closed if the model omits an explicit verdict.
        is_safe = safety_res.get("is_safe")
        if is_safe is None:
            is_safe = False
        warnings = safety_res.get("warnings", [])
        summary = safety_res.get("safety_summary", "Prescription safety check complete.")

        safety_eval = {
            "is_safe": is_safe,
            "confidence_score": safety_res.get("confidence_score"),
            "warnings_count": len(warnings),
            "warnings": warnings,
            "safety_summary": summary,
            "risk_level": safety_res.get("risk_level", "LOW" if is_safe else "CRITICAL"),
            "requires_manual_review": not is_safe,
            "evaluated_at": now_utc,
            "overridden": False,
            "provider": "Google Cloud Vertex AI",
            "model_used": settings.GEMINI_REASONING_MODEL,
            "region": settings.GEMINI_REASONING_LOCATION,
            "latency_ms": latency_ms,
            "execution_status": "live"
        }

        # Save to Firestore consultation document. Stamp the exact medication
        # signature evaluated so the approval gate can detect stale checks when
        # the prescription is modified after this evaluation.
        await update_document("consultations", consultation_id, {
            "safety_evaluation": safety_eval,
            "safety_eval_completed": True,
            "safety_evaluated_medications": _medication_signature(medications),
            "updated_at": now_utc
        })

        await self.logger.log_decision(
            decision_type="drug_safety_evaluated",
            decision_made=f"Evaluated {len(medications)} drugs for safety via {settings.GEMINI_REASONING_MODEL}. Safe: {is_safe}. Warnings: {len(warnings)}",
            clinic_id=clinic_id,
            consultation_id=consultation_id,
            model_used=settings.GEMINI_REASONING_MODEL,
            latency_ms=latency_ms
        )

        return safety_eval

    async def override_safety_warning(
        self,
        consultation_id: str,
        clinic_id: str,
        doctor_uid: str,
        override_reason: str
    ) -> Dict[str, Any]:
        """
        Allows doctor to override safety warnings with mandatory clinical audit reason.
        """
        consultation = await get_document("consultations", consultation_id)
        if not consultation:
            return {"error": "Consultation not found"}

        now_utc = datetime.now(timezone.utc)
        safety_eval = consultation.get("safety_evaluation", {})
        safety_eval["overridden"] = True
        safety_eval["override_reason"] = override_reason
        safety_eval["overridden_by"] = doctor_uid
        safety_eval["overridden_at"] = now_utc

        await update_document("consultations", consultation_id, {
            "safety_evaluation": safety_eval,
            "updated_at": now_utc
        })

        await self.logger.log_decision(
            decision_type="drug_safety_overridden",
            decision_made=f"Doctor '{doctor_uid}' overridden safety warning for consultation {consultation_id}. Reason: {override_reason}",
            clinic_id=clinic_id,
            consultation_id=consultation_id
        )

        return {"status": "overridden", "consultation_id": consultation_id}
