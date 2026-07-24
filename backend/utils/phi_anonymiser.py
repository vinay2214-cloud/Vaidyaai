import re
from typing import Optional


def anonymise_for_llm(text: str, patient_name: Optional[str] = None) -> str:
    """
    Remove PHI (Protected Health Information) from clinical transcripts/text 
    before passing to external Gemini LLM APIs.
    Removes:
      - Indian phone numbers (including formats with spaces, hyphens, prefixes)
      - Aadhaar card patterns (12 digits)
      - Email addresses
      - Explicit patient names
    """
    if not text:
        return ""

    anonymised = text

    # Remove Indian phone numbers with optional +91/0 prefix and optional spaces/hyphens
    # Matches: +91 98765 43210, +91-98765-43210, 098765 43210, 9876543210, etc.
    anonymised = re.sub(r"(\+91[\s\-]?)?\(?0?[6-9]\d{2}\)?[\s\-]?\d{3,4}[\s\-]?\d{4}", "[PHONE]", anonymised)

    # Remove Aadhaar card patterns (12 digits, optional space/hyphen separation)
    anonymised = re.sub(r"\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b", "[ID]", anonymised)

    # Remove generic email addresses
    anonymised = re.sub(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", "[EMAIL]", anonymised)

    # Remove explicit patient name if supplied
    if patient_name and len(patient_name.strip()) > 1:
        name_clean = patient_name.strip()
        anonymised = re.sub(re.escape(name_clean), "the patient", anonymised, flags=re.IGNORECASE)
        
        # Also replace individual name tokens if longer than 2 chars
        tokens = [t for t in name_clean.split() if len(t) > 2]
        for token in tokens:
            anonymised = re.sub(r"\b" + re.escape(token) + r"\b", "the patient", anonymised, flags=re.IGNORECASE)

    return anonymised
