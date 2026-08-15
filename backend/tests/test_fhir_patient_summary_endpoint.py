"""Regression tests for GET /api/v1/fhir/Patient/{patient_id}/summary.

The endpoint previously returned HTTP 500 because it passed `order_by` /
`direction` to `query_documents`, which did not accept them:

    TypeError: query_collection() got an unexpected keyword argument 'order_by'

These tests pin both halves of the contract: the query abstraction really
supports ordering (newest-first, applied before the limit), and the endpoint
returns a well-formed, correctly-ordered Bundle.
"""
import inspect
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from database import firestore as fs
from database.firestore import query_documents, set_document
from main import app

CLINIC_ID = "cln_e2e_test_clinic"
PATIENT_ID = "pat_fhir_summary_test"
AUTH = {"Authorization": "Bearer dev_mock_id_token"}
BASE = datetime(2026, 8, 1, 9, 0, tzinfo=timezone.utc)


@pytest.fixture(autouse=True)
def _clean_store():
    fs._in_memory_store.clear()
    yield
    fs._in_memory_store.clear()


async def _seed(consultation_count=3, review_status="CONFIRMED"):
    await set_document("clinics", CLINIC_ID, {
        "clinic_id": CLINIC_ID, "name": "Demo Clinic",
        "doctor_name": "Dr Demo", "phone": "+915550000000", "location": "Tirupati",
    })
    await set_document("patients", PATIENT_ID, {
        "patient_id": PATIENT_ID, "clinic_id": CLINIC_ID, "name": "DEMO Patient",
        "phone": "+915550001111", "gender": "female", "age": 34,
    })
    for i in range(consultation_count):
        cid = f"cons_fhir_{i}"
        await set_document("consultations", cid, {
            "consultation_id": cid, "patient_id": PATIENT_ID, "clinic_id": CLINIC_ID,
            "status": "approved", "review_status": review_status,
            "created_at": BASE + timedelta(days=i),
            "chief_complaint": f"Complaint {i}",
            "diagnoses": [{"description": "Acute URI", "icd10_code": "J06.9"}],
            "medications": [{"drug_name": "Paracetamol", "dosage": "500mg"}],
        })


# ── query abstraction contract ────────────────────────────────────────────

def test_query_collection_accepts_order_by_and_direction():
    sig = inspect.signature(query_documents)
    assert "order_by" in sig.parameters
    assert "direction" in sig.parameters


@pytest.mark.asyncio
async def test_query_orders_newest_first():
    await _seed(consultation_count=3)
    rows = await query_documents(
        "consultations", [("patient_id", "==", PATIENT_ID)],
        order_by="created_at", direction="DESCENDING")
    assert [r["consultation_id"] for r in rows] == ["cons_fhir_2", "cons_fhir_1", "cons_fhir_0"]


@pytest.mark.asyncio
async def test_ordering_is_applied_before_limit():
    """A limit must return the newest N, not an arbitrary N that is then sorted."""
    await _seed(consultation_count=3)
    rows = await query_documents(
        "consultations", [("patient_id", "==", PATIENT_ID)],
        limit=1, order_by="created_at", direction="DESCENDING")
    assert [r["consultation_id"] for r in rows] == ["cons_fhir_2"]


@pytest.mark.asyncio
async def test_documents_missing_order_field_sort_last_and_do_not_raise():
    await _seed(consultation_count=2)
    await set_document("consultations", "cons_no_date", {
        "consultation_id": "cons_no_date", "patient_id": PATIENT_ID,
        "clinic_id": CLINIC_ID, "review_status": "CONFIRMED",
    })
    rows = await query_documents(
        "consultations", [("patient_id", "==", PATIENT_ID)],
        order_by="created_at", direction="DESCENDING")
    assert rows[-1]["consultation_id"] == "cons_no_date"


# ── endpoint contract ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_patient_summary_returns_200_and_ordered_bundle():
    await _seed(consultation_count=3)
    with TestClient(app) as client:
        resp = client.get(f"/api/v1/fhir/Patient/{PATIENT_ID}/summary", headers=AUTH)
    assert resp.status_code == 200, resp.text
    bundle = resp.json()
    assert bundle["resourceType"] == "Bundle"

    entries = bundle.get("entry", [])
    types = [e["resource"]["resourceType"] for e in entries]
    assert "Patient" in types and "Composition" in types

    # Every internal reference must resolve inside the bundle.
    present = {
        f"{e['resource']['resourceType']}/{e['resource']['id']}"
        for e in entries if e.get("resource", {}).get("id")
    }

    def _refs(node, out):
        if isinstance(node, dict):
            for k, v in node.items():
                if k == "reference" and isinstance(v, str):
                    out.append(v)
                else:
                    _refs(v, out)
        elif isinstance(node, list):
            for i in node:
                _refs(i, out)
        return out

    dangling = [
        r for r in _refs(bundle, [])
        if "/" in r and not r.startswith(("http", "urn:")) and r not in present
    ]
    assert not dangling, f"dangling references: {sorted(set(dangling))}"


@pytest.mark.asyncio
async def test_patient_summary_unknown_patient_returns_404_not_500():
    await _seed()
    with TestClient(app) as client:
        resp = client.get("/api/v1/fhir/Patient/pat_does_not_exist/summary", headers=AUTH)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_patient_summary_with_no_consultations_returns_200():
    await _seed(consultation_count=0)
    with TestClient(app) as client:
        resp = client.get(f"/api/v1/fhir/Patient/{PATIENT_ID}/summary", headers=AUTH)
    assert resp.status_code == 200, resp.text
    assert resp.json()["resourceType"] == "Bundle"


@pytest.mark.asyncio
async def test_patient_summary_requires_authentication():
    await _seed()
    with TestClient(app) as client:
        resp = client.get(f"/api/v1/fhir/Patient/{PATIENT_ID}/summary")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_patient_summary_rejects_cross_tenant_access():
    await _seed()
    await set_document("patients", "pat_other_clinic", {
        "patient_id": "pat_other_clinic", "clinic_id": "cln_some_other_clinic",
        "name": "DEMO Other", "phone": "+915550002222",
    })
    with TestClient(app) as client:
        resp = client.get("/api/v1/fhir/Patient/pat_other_clinic/summary", headers=AUTH)
    assert resp.status_code == 403
