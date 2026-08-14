import os
import json
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

# Lazy import: google.cloud.tasks_v2 brings in heavy protobuf / gRPC tree.
tasks_v2 = None
timestamp_pb2 = None
_tasks_import_attempted = False


def _ensure_tasks_imported():
    global tasks_v2, timestamp_pb2, _tasks_import_attempted
    if _tasks_import_attempted:
        return
    _tasks_import_attempted = True
    try:
        from google.cloud import tasks_v2 as _tv2
        from google.protobuf import timestamp_pb2 as _ts
        tasks_v2 = _tv2
        timestamp_pb2 = _ts
    except ImportError:
        tasks_v2 = None
        timestamp_pb2 = None

from config import settings

logger = logging.getLogger("vaidyaai.tasks.cloud_tasks")

_client: Optional[Any] = None


def get_tasks_client() -> Optional[Any]:
    global _client
    _ensure_tasks_imported()
    if settings.is_development:
        return None
    if _client is None and tasks_v2 is not None:
        try:
            _client = tasks_v2.CloudTasksClient()
        except Exception as e:
            logger.warning(f"Could not initialize CloudTasksClient: {e}")
            _client = None
    return _client


def _create_http_task_sync(
    queue_name: str,
    payload: Dict[str, Any],
    schedule_time: Optional[datetime] = None
) -> Optional[str]:
    client = get_tasks_client()
    if not client or tasks_v2 is None:
        logger.warning("Cloud Tasks client not available. Skipping task creation.")
        return None

    parent = client.queue_path(
        settings.GOOGLE_CLOUD_PROJECT,
        settings.CLOUD_TASKS_LOCATION,
        queue_name
    )

    url = f"{settings.BACKEND_URL}/internal/tasks/execute"
    payload_bytes = json.dumps(payload).encode("utf-8")

    task = {
        "http_request": {
            "http_method": tasks_v2.HttpMethod.POST,
            "url": url,
            "headers": {"Content-Type": "application/json"},
            "body": payload_bytes,
            "oidc_token": {
                "service_account_email": f"vaidyaai-backend@{settings.GOOGLE_CLOUD_PROJECT}.iam.gserviceaccount.com",
                "audience": settings.BACKEND_URL
            }
        }
    }

    if schedule_time and timestamp_pb2 is not None:
        if schedule_time.tzinfo is None:
            schedule_time = schedule_time.replace(tzinfo=timezone.utc)
        timestamp = timestamp_pb2.Timestamp()
        timestamp.FromDatetime(schedule_time)
        task["schedule_time"] = timestamp

    try:
        response = client.create_task(request={"parent": parent, "task": task})
        logger.info(f"Created Cloud Task '{response.name}' in queue '{queue_name}'")
        return response.name
    except Exception as e:
        logger.error(f"Failed to create Cloud Task in queue '{queue_name}': {e}")
        return None


async def schedule_appointment_reminder(
    appointment_id: str,
    slot_time: datetime,
    patient_phone: str,
    clinic_id: str,
    language: str = "te"
) -> Optional[str]:
    reminder_time = slot_time - timedelta(hours=2)
    now = datetime.now(timezone.utc)
    if reminder_time <= now:
        reminder_time = now + timedelta(minutes=1)

    payload = {
        "task_type": "APPOINTMENT_REMINDER",
        "appointment_id": appointment_id,
        "patient_phone": patient_phone,
        "clinic_id": clinic_id,
        "language": language
    }
    return await asyncio.to_thread(
        _create_http_task_sync,
        settings.CLOUD_TASKS_QUEUE_REMINDERS,
        payload,
        reminder_time
    )


async def schedule_wellness_check(
    appointment_id: str,
    slot_time: datetime,
    patient_phone: str,
    clinic_id: str,
    language: str = "te"
) -> Optional[str]:
    wellness_time = slot_time + timedelta(hours=24)
    payload = {
        "task_type": "WELLNESS_CHECK",
        "appointment_id": appointment_id,
        "patient_phone": patient_phone,
        "clinic_id": clinic_id,
        "language": language
    }
    return await asyncio.to_thread(
        _create_http_task_sync,
        settings.CLOUD_TASKS_QUEUE_REMINDERS,
        payload,
        wellness_time
    )


async def schedule_billing_followup(
    invoice_id: str,
    patient_phone: str,
    clinic_id: str,
    amount_paise: int,
    language: str = "te"
) -> Optional[str]:
    followup_time = datetime.now(timezone.utc) + timedelta(hours=24)
    payload = {
        "task_type": "BILLING_FOLLOWUP",
        "invoice_id": invoice_id,
        "patient_phone": patient_phone,
        "clinic_id": clinic_id,
        "amount_paise": amount_paise,
        "language": language
    }
    return await asyncio.to_thread(
        _create_http_task_sync,
        settings.CLOUD_TASKS_QUEUE_BILLING,
        payload,
        followup_time
    )


def _cancel_task_sync(task_name: str) -> bool:
    client = get_tasks_client()
    if not client or not task_name:
        return False
    try:
        client.delete_task(name=task_name)
        logger.info(f"Cancelled Cloud Task '{task_name}'")
        return True
    except Exception as e:
        logger.warning(f"Could not cancel Cloud Task '{task_name}': {e}")
        return False


async def cancel_task(task_name: Optional[str]) -> bool:
    if not task_name:
        return False
    return await asyncio.to_thread(_cancel_task_sync, task_name)
