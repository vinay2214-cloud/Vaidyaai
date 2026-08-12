import pytest
from httpx import AsyncClient, ASGITransport
from main import app
from database import firestore as fs


@pytest.fixture(autouse=True)
def setup_store():
    fs._in_memory_store.clear()
    yield
    fs._in_memory_store.clear()


@pytest.mark.asyncio
async def test_walk_in_with_existing_patient_id():
    # 1. Provision a test patient for the dev clinic
    test_patient = {
        "patient_id": "pat_regression_001",
        "clinic_id": "cln_e2e_test_clinic",
        "name": "Suresh Patel",
        "phone": "+919876543210",
        "phone_masked": "+91 98765-XXXXX",
        "allergies": ["Penicillin"],
        "visit_count": 2,
    }
    await fs.set_document("patients", "pat_regression_001", test_patient)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Request walk-in using patient_id
        res = await client.post(
            "/api/v1/appointments/walk-in",
            json={
                "clinic_id": "cln_e2e_test_clinic",
                "patient_id": "pat_regression_001",
                "complaint_summary": "Follow-up consultation",
                "consultation_type": "followup"
            },
            headers={"Authorization": "Bearer dev_access_token_doc_vaidya_2026"}
        )

        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "appointment_id" in data
        assert data["patient_id"] == "pat_regression_001"
        assert data["patient_name"] == "Suresh Patel"


@pytest.mark.asyncio
async def test_walk_in_with_invalid_patient_id_raises_404():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/appointments/walk-in",
            json={
                "clinic_id": "cln_e2e_test_clinic",
                "patient_id": "pat_nonexistent_999",
                "complaint_summary": "Walk-in"
            },
            headers={"Authorization": "Bearer dev_access_token_doc_vaidya_2026"}
        )

        assert res.status_code == 404
        assert "not exist" in res.json()["detail"].lower()
