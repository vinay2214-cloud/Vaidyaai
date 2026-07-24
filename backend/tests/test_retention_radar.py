import pytest
from prompts.retention_outreach import build_retention_outreach_prompt


def test_retention_prompt_builder():
    prompt = build_retention_outreach_prompt(
        patient_name="Ramesh",
        diagnosis="Acute Bronchitis",
        followup_days=5,
        language_code="te"
    )

    assert "Ramesh" in prompt
    assert "Bronchitis" in prompt
    assert "5 days" in prompt
    assert "TELUGU" in prompt.upper()
