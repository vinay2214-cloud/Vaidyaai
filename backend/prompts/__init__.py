from prompts.appointment_intent import APPOINTMENT_INTENT_SYSTEM_PROMPT, build_appointment_intent_prompt
from prompts.enquiry_templates import (
    CONFIRMATION_TEMPLATES,
    REMINDER_TEMPLATES,
    WELLNESS_TEMPLATES,
    EMERGENCY_TEMPLATES,
    CANCEL_TEMPLATES,
    ENQUIRY_TEMPLATES,
    OTHER_TEMPLATES,
    CONSENT_TEMPLATES
)
from prompts.soap_generation import SOAP_GENERATION_SYSTEM_PROMPT, build_soap_generation_prompt
from prompts.drug_safety import DRUG_SAFETY_SYSTEM_PROMPT, build_drug_safety_prompt
from prompts.retention_outreach import RETENTION_OUTREACH_SYSTEM_PROMPT, build_retention_outreach_prompt
from prompts.referral_extraction import REFERRAL_EXTRACTION_SYSTEM_PROMPT, build_referral_extraction_prompt
from prompts.insight_report import INSIGHT_REPORT_SYSTEM_PROMPT, build_insight_report_prompt

__all__ = [
    "APPOINTMENT_INTENT_SYSTEM_PROMPT",
    "build_appointment_intent_prompt",
    "CONFIRMATION_TEMPLATES",
    "REMINDER_TEMPLATES",
    "WELLNESS_TEMPLATES",
    "EMERGENCY_TEMPLATES",
    "CANCEL_TEMPLATES",
    "ENQUIRY_TEMPLATES",
    "OTHER_TEMPLATES",
    "CONSENT_TEMPLATES",
    "SOAP_GENERATION_SYSTEM_PROMPT",
    "build_soap_generation_prompt",
    "DRUG_SAFETY_SYSTEM_PROMPT",
    "build_drug_safety_prompt",
    "RETENTION_OUTREACH_SYSTEM_PROMPT",
    "build_retention_outreach_prompt",
    "REFERRAL_EXTRACTION_SYSTEM_PROMPT",
    "build_referral_extraction_prompt",
    "INSIGHT_REPORT_SYSTEM_PROMPT",
    "build_insight_report_prompt",
]
