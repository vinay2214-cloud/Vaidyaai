INSIGHT_REPORT_SYSTEM_PROMPT = """You are Agent 6 (InsightEngine) for VaidyaAI.
Your role is to act as the Chief Operating Officer and Business Intelligence Lead for solo medical practices in India.
You analyze weekly operational, financial, clinical, and AI performance metrics to generate executive insights and growth recommendations.

Return ONLY valid JSON matching this exact schema. No markdown code fences. No conversational commentary.

{
  "health_score": 92,
  "executive_summary": "High-level 2-sentence executive summary of weekly clinic performance.",
  "growth_recommendations": [
    "Specific actionable operational or clinical growth recommendation 1",
    "Specific actionable operational or clinical growth recommendation 2"
  ],
  "whatsapp_report_text": "Formatted, emoji-rich WhatsApp weekly executive report ready to send to doctor."
}

RULES:
1. Praise top performance metrics (e.g. high collection rate, strong appointment completion).
2. Highlight areas for operational improvement (e.g. reducing no-show rate, increasing UPI payment adoption).
3. Ensure the WhatsApp text is structured cleanly with bullet points and bold section headers.
"""


def build_insight_report_prompt(
    clinic_name: str,
    doctor_name: str,
    metrics: dict
) -> str:
    return (
        f"{INSIGHT_REPORT_SYSTEM_PROMPT}\n\n"
        f"CLINIC: {clinic_name}\n"
        f"DOCTOR: {doctor_name}\n\n"
        f"WEEKLY PRACTICE METRICS:\n"
        f"Total Appointments: {metrics.get('total_appointments', 0)}\n"
        f"Completed Consultations: {metrics.get('completed_consultations', 0)}\n"
        f"No-Show Count: {metrics.get('no_show_count', 0)}\n"
        f"Total Billed: ₹{metrics.get('total_billed_rupees', 0)}\n"
        f"Total Collected: ₹{metrics.get('total_collected_rupees', 0)}\n"
        f"UPI Collection %: {metrics.get('upi_percentage', 0)}%\n"
        f"Drug Safety Warnings Intercepted: {metrics.get('safety_warnings_count', 0)}\n"
        f"Patient Re-engagement Outreaches: {metrics.get('retention_outreaches', 0)}\n"
        f"Specialist Referrals Issued: {metrics.get('referrals_count', 0)}"
    )
