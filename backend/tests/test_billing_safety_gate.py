"""Regression: invoice creation must be blocked when the consultation has a
stored unsafe, non-overridden safety evaluation — even if no medications are
persisted on the consultation (prevents direct-create bypass)."""
import pytest
from httpx import AsyncClient, ASGITransport


@pytest.mark.asyncio
async def test_invoice_blocked_when_stored_safety_eval_unsafe():
    from main import app
    from api.auth import get_current_user
    from database.firestore import set_document

    try:
        app.dependency_overrides[get_current_user] = lambda: {
            "uid": "doc", "clinic_id": "cln_t", "role": "doctor"
        }
        await set_document("consultations", "cons_unsafe", {
            "consultation_id": "cons_unsafe",
            "clinic_id": "cln_t",
            "patient_id": "pat_x",
            "medications": [],
            "safety_evaluation": {"is_safe": False, "overridden": False, "risk_level": "CRITICAL"},
        })
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://t") as ac:
            resp = await ac.post("/api/v1/billing/create-invoice", json={
                "clinic_id": "cln_t", "consultation_id": "cons_unsafe",
                "patient_phone": "9182736455", "patient_id": "pat_x",
            })
        assert resp.status_code == 409, resp.text
        assert "unsafe" in resp.json()["detail"].lower()
    finally:
        app.dependency_overrides.clear()
