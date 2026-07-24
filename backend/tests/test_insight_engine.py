import pytest
from prompts.insight_report import build_insight_report_prompt


def test_insight_report_prompt_builder():
    metrics = {
        "total_appointments": 20,
        "completed_consultations": 18,
        "no_show_count": 2,
        "total_billed_rupees": 6000.0,
        "total_collected_rupees": 5400.0,
        "upi_percentage": 85.0
    }
    prompt = build_insight_report_prompt("Tirupati General Clinic", "Dr. Ramesh", metrics)

    assert "Tirupati General Clinic" in prompt
    assert "Dr. Ramesh" in prompt
    assert "6000.0" in prompt
    assert "85.0" in prompt
    assert "EXECUTIVE" in prompt.upper()
