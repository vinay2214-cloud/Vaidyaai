"""
SSE real-time stream tenant isolation regression tests.

The security-critical filtering logic is extracted into the pure function
``is_event_authorized`` so it can be tested deterministically without blocking
on a long-lived SSE stream. These tests verify the fail-closed tenant gate:
  - events owned by the consumer's clinic are authorized
  - events owned by another clinic are rejected
  - events with a missing clinic_id are rejected
  - a consumer with no clinic scope is rejected for everything
"""
import pytest

from api.stream import is_event_authorized

USER_CLINIC = "cln_e2e_test_clinic"
OTHER_CLINIC = "cln_other_clinic"


def _event(clinic_id):
    return {
        "event_id": "evt_test",
        "event_type": "consultation_started",
        "clinic_id": clinic_id,
        "patient_id": "pat_x",
        "consultation_id": "cons_x",
        "payload": {},
    }


def test_event_owned_by_consumer_clinic_is_authorized():
    assert is_event_authorized(_event(USER_CLINIC), USER_CLINIC) is True


def test_event_owned_by_other_clinic_is_rejected():
    # A user for clinic A must NEVER receive clinic B's events.
    assert is_event_authorized(_event(OTHER_CLINIC), USER_CLINIC) is False


def test_event_with_missing_clinic_id_is_rejected():
    # Fail-closed: an event with no clinic ownership must never leak.
    assert is_event_authorized(_event(None), USER_CLINIC) is False
    assert is_event_authorized(_event(""), USER_CLINIC) is False


def test_consumer_without_clinic_scope_is_rejected_for_everything():
    # A user with no clinic scope must not receive any event.
    assert is_event_authorized(_event(USER_CLINIC), "") is False
    assert is_event_authorized(_event(USER_CLINIC), None) is False


def test_exact_clinic_match_required_not_prefix():
    # A prefix or substring must not grant access (exact equality only).
    assert is_event_authorized(_event("cln_e2e_test_clinic_extra"), USER_CLINIC) is False
    assert is_event_authorized(_event("cln_e2e_test_clini"), USER_CLINIC) is False
