import os
import json
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
import firebase_admin
from firebase_admin import credentials, firestore
from config import settings

logger = logging.getLogger("vaidyaai.database.firestore")

_db: Optional[Any] = None
_in_memory_store: Dict[str, Dict[str, Any]] = {}
_use_in_memory: bool = False

# ── Development-only durable snapshot of the in-memory document store ──────
# Without this, the process-local store means `seed_demo_data.py` (one process)
# leaves the API server (another process) with an empty database, and a backend
# restart wipes the demo dataset. Strictly development/demo behaviour: it is
# never enabled in production, where a live Firestore client is mandatory.
_DEV_SNAPSHOT_SENTINEL = "__dt__"
_dev_snapshot_loaded: bool = False
_dev_snapshot_mtime: Optional[float] = None


def _dev_snapshot_path() -> Optional[str]:
    """Path of the dev store snapshot, or None when snapshotting is disabled."""
    if settings.is_production:
        return None
    # Tests must stay hermetic: never share state through a snapshot file.
    if "PYTEST_CURRENT_TEST" in os.environ or settings.ENVIRONMENT == "testing":
        return None
    if os.getenv("DEV_STORE_PERSIST", "true").lower() in ("false", "0", "no"):
        return None
    return os.getenv(
        "DEV_STORE_PATH",
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".devstore.json"),
    )


def _encode(value: Any) -> Any:
    if isinstance(value, datetime):
        return {_DEV_SNAPSHOT_SENTINEL: value.isoformat()}
    if isinstance(value, dict):
        return {k: _encode(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_encode(v) for v in value]
    return value


def _decode(value: Any) -> Any:
    if isinstance(value, dict):
        if set(value.keys()) == {_DEV_SNAPSHOT_SENTINEL}:
            try:
                return datetime.fromisoformat(value[_DEV_SNAPSHOT_SENTINEL])
            except ValueError:
                return None
        return {k: _decode(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_decode(v) for v in value]
    return value


def _load_dev_snapshot() -> None:
    """Adopt the dev snapshot whenever another process has rewritten it.

    The snapshot file is the durable source of truth in development: it is
    re-read on start-up and whenever its mtime changes, so re-running the seed
    script while the API server is up is picked up instead of being silently
    overwritten by this process's stale copy.
    """
    global _dev_snapshot_loaded, _dev_snapshot_mtime
    path = _dev_snapshot_path()
    if not path or not os.path.exists(path):
        _dev_snapshot_loaded = True
        return
    try:
        mtime = os.path.getmtime(path)
        if _dev_snapshot_loaded and mtime == _dev_snapshot_mtime:
            return
        with open(path, "r", encoding="utf-8") as fh:
            raw = json.load(fh)
        _in_memory_store.clear()
        for key, doc in raw.items():
            _in_memory_store[key] = _decode(doc)
        _dev_snapshot_loaded = True
        _dev_snapshot_mtime = mtime
        logger.info(f"Loaded {len(raw)} documents from development store snapshot.")
    except Exception as e:
        logger.warning(f"Could not load development store snapshot ({path}): {e}")


def _save_dev_snapshot() -> None:
    """Atomically persist the dev store. Never raises into the request path."""
    global _dev_snapshot_mtime
    path = _dev_snapshot_path()
    if not path:
        return
    try:
        tmp = f"{path}.tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump({k: _encode(v) for k, v in _in_memory_store.items()}, fh)
        os.replace(tmp, path)
        # Remember our own write so it is not mistaken for an external change.
        _dev_snapshot_mtime = os.path.getmtime(path)
    except Exception as e:
        logger.warning(f"Could not persist development store snapshot ({path}): {e}")


def _should_use_in_memory_store() -> bool:
    """
    Returns True when request handlers should use the process-local document
    store instead of a live Firestore client.
    """
    if _use_in_memory:
        return True
    explicit_store = os.getenv("USE_IN_MEMORY_STORE", "").lower()
    if explicit_store in ["true", "1", "yes"]:
        if settings.is_production:
            raise RuntimeError("SECURITY: USE_IN_MEMORY_STORE=true is forbidden in production")
        return True
    if explicit_store in ["false", "0", "no"]:
        return False
    if "PYTEST_CURRENT_TEST" in os.environ or settings.ENVIRONMENT == "testing":
        return True
    if settings.is_development and os.getenv("FIRESTORE_EMULATOR_HOST") is None:
        return True
    # Production must NOT use in-memory store
    if settings.is_production:
        return False
    return False


async def init_firestore():
    global _db
    if _should_use_in_memory_store():
        logger.info("Using in-memory Firestore-compatible document store.")
        _db = None
        return None

    if not firebase_admin._apps:
        try:
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred, {
                'projectId': settings.FIREBASE_PROJECT_ID
            })
            logger.info(f"Firebase Admin SDK initialized with ApplicationDefault credentials for project '{settings.FIREBASE_PROJECT_ID}'")
        except Exception as e:
            logger.info(f"ApplicationDefault credentials fallback notice: {e}. Initializing with project ID options...")
            try:
                firebase_admin.initialize_app(options={
                    'projectId': settings.FIREBASE_PROJECT_ID
                })
            except Exception as init_err:
                logger.warning(f"Firebase Admin initialize_app notice: {init_err}")

    try:
        _db = firestore.client()
        logger.info(f"Successfully connected to Firestore client for project '{settings.FIREBASE_PROJECT_ID}'")
    except Exception as e:
        if settings.is_production:
            raise RuntimeError(
                f"🚨 Production Failure: Could not initialize live Firestore client for project '{settings.FIREBASE_PROJECT_ID}': {e}. "
                "Ensure GOOGLE_APPLICATION_CREDENTIALS or Secret Manager credentials are valid."
            ) from e

        logger.warning(
            f"⚠️ Could not connect to Firestore: {e}. "
            "To connect to live Firestore or emulator in development, configure Application Default Credentials "
            "('gcloud auth application-default login') or start the emulator ('export FIRESTORE_EMULATOR_HOST=127.0.0.1:8181')."
        )
        _db = None
    return _db


def get_firestore_client():
    global _db
    if _should_use_in_memory_store():
        return None
    if _db is None:
        if not firebase_admin._apps:
            try:
                cred = credentials.ApplicationDefault()
                firebase_admin.initialize_app(cred, {
                    'projectId': settings.FIREBASE_PROJECT_ID
                })
            except Exception:
                try:
                    firebase_admin.initialize_app(options={
                        'projectId': settings.FIREBASE_PROJECT_ID
                    })
                except Exception:
                    pass
        try:
            _db = firestore.client()
        except Exception as e:
            if settings.is_production:
                raise RuntimeError(
                    f"🚨 Production Failure: Could not initialize live Firestore client for project '{settings.FIREBASE_PROJECT_ID}': {e}"
                ) from e
            _db = None
    return _db


def _get_document_sync(collection_name: str, doc_id: str) -> Optional[Dict[str, Any]]:
    db = get_firestore_client()
    if db is not None:
        try:
            doc_ref = db.collection(collection_name).document(doc_id)
            doc = doc_ref.get(timeout=5.0)
            if doc.exists:
                data = doc.to_dict()
                data["id"] = doc.id
                return data
        except Exception as e:
            logger.warning(f"Firestore sync get_document failed: {e}. Checking in-memory fallback.")

    _load_dev_snapshot()
    key = f"{collection_name}/{doc_id}"
    return _in_memory_store.get(key)


async def get_document(collection_name: str, doc_id: str) -> Optional[Dict[str, Any]]:
    return await asyncio.to_thread(_get_document_sync, collection_name, doc_id)


def _set_document_sync(collection_name: str, doc_id: str, data: Dict[str, Any], merge: bool = True) -> None:
    _load_dev_snapshot()
    key = f"{collection_name}/{doc_id}"
    if merge and key in _in_memory_store:
        _in_memory_store[key].update(data)
    else:
        _in_memory_store[key] = dict(data)
    _save_dev_snapshot()

    db = get_firestore_client()
    if db is not None:
        try:
            doc_ref = db.collection(collection_name).document(doc_id)
            doc_ref.set(data, merge=merge, timeout=5.0)
        except Exception as e:
            logger.warning(f"Firestore set_document live write failed: {e}")


async def set_document(collection_name: str, doc_id: str, data: Dict[str, Any], merge: bool = True) -> None:
    await asyncio.to_thread(_set_document_sync, collection_name, doc_id, data, merge)


def _update_document_sync(collection_name: str, doc_id: str, data: Dict[str, Any]) -> None:
    _load_dev_snapshot()
    key = f"{collection_name}/{doc_id}"
    if key in _in_memory_store:
        _in_memory_store[key].update(data)
    else:
        _in_memory_store[key] = dict(data)
    _save_dev_snapshot()

    db = get_firestore_client()
    if db is not None:
        try:
            doc_ref = db.collection(collection_name).document(doc_id)
            doc_ref.update(data)
        except Exception as e:
            logger.warning(f"Firestore update_document live write failed: {e}")


async def update_document(collection_name: str, doc_id: str, data: Dict[str, Any]) -> None:
    await asyncio.to_thread(_update_document_sync, collection_name, doc_id, data)


def _delete_document_sync(collection_name: str, doc_id: str) -> None:
    _load_dev_snapshot()
    key = f"{collection_name}/{doc_id}"
    _in_memory_store.pop(key, None)
    _save_dev_snapshot()

    db = get_firestore_client()
    if db is not None:
        try:
            db.collection(collection_name).document(doc_id).delete()
        except Exception as e:
            logger.warning(f"Firestore delete_document live write failed: {e}")


async def delete_document(collection_name: str, doc_id: str) -> None:
    await asyncio.to_thread(_delete_document_sync, collection_name, doc_id)


DESCENDING = "DESCENDING"
ASCENDING = "ASCENDING"


def _sort_key(value: Any):
    """Total-ordering sort key tolerant of mixed/missing values.

    Documents missing the ordering field (or holding an unorderable type) must
    not raise; they sort last in ascending order so clinical history ordering
    stays deterministic even for partially-populated records.
    """
    if value is None:
        return (2, "")
    if isinstance(value, datetime):
        # Naive timestamps are treated as UTC so they remain comparable.
        return (0, value if value.tzinfo else value.replace(tzinfo=timezone.utc))
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return (0, datetime.fromtimestamp(value, tz=timezone.utc))
    return (1, str(value))


def _sort_documents(docs: List[Dict[str, Any]], order_by: str, direction: str) -> List[Dict[str, Any]]:
    descending = str(direction).upper() == DESCENDING
    # Documents missing the ordering field always sort last, in both directions,
    # so a null created_at can never masquerade as the most recent encounter.
    present = [d for d in docs if d.get(order_by) is not None]
    missing = [d for d in docs if d.get(order_by) is None]
    present.sort(key=lambda d: _sort_key(d.get(order_by)), reverse=descending)
    return present + missing


def _query_collection_sync(
    collection_name: str,
    filters: List[tuple],
    limit: Optional[int] = None,
    offset: Optional[int] = None,
    order_by: Optional[str] = None,
    direction: str = ASCENDING,
) -> List[Dict[str, Any]]:
    db = get_firestore_client()
    if db is not None:
        try:
            query = db.collection(collection_name)
            for field, op, val in filters:
                query = query.where(field, op, val)
            if order_by:
                query = query.order_by(order_by, direction=direction)
            if offset:
                query = query.offset(offset)
            if limit:
                query = query.limit(limit)
            docs = query.stream(timeout=5.0)
            result = []
            for doc in docs:
                d = doc.to_dict()
                d["id"] = doc.id
                result.append(d)
            return result
        except Exception as e:
            logger.warning(f"Firestore query_collection live search failed: {e}. Falling back to in-memory store.")

    # In-memory query fallback
    _load_dev_snapshot()
    prefix = f"{collection_name}/"
    res = []
    for k, v in _in_memory_store.items():
        if k.startswith(prefix):
            match = True
            for field, op, val in filters:
                if op == "==" and v.get(field) != val:
                    match = False
                    break
            if match:
                d = dict(v)
                d["id"] = k.split("/")[-1]
                res.append(d)

    # Ordering must be applied BEFORE offset/limit, otherwise the caller gets an
    # arbitrary slice that is merely sorted afterwards (wrong clinical history).
    if order_by:
        res = _sort_documents(res, order_by, direction)

    start = offset or 0
    if limit is not None:
        return res[start:start + limit]
    return res[start:]


async def query_collection(
    collection_name: str,
    filters: List[tuple],
    limit: Optional[int] = None,
    offset: Optional[int] = None,
    order_by: Optional[str] = None,
    direction: str = ASCENDING,
) -> List[Dict[str, Any]]:
    return await asyncio.to_thread(
        _query_collection_sync, collection_name, filters, limit, offset, order_by, direction
    )

query_documents = query_collection


def _get_clinic_by_whatsapp_phone_id_sync(phone_id: str) -> Optional[Dict[str, Any]]:
    db = get_firestore_client()
    if db is not None:
        try:
            docs = db.collection("clinics").where("whatsapp_phone_id", "==", phone_id).limit(1).stream(timeout=3.0)
            for doc in docs:
                d = doc.to_dict()
                d["clinic_id"] = doc.id
                return d
        except Exception as e:
            logger.warning(f"Firestore get_clinic_by_whatsapp_phone_id failed: {e}")

    for k, v in _in_memory_store.items():
        if k.startswith("clinics/") and v.get("whatsapp_phone_id") == phone_id:
            d = dict(v)
            d["clinic_id"] = k.split("/")[-1]
            return d
    return None


async def get_clinic_by_whatsapp_phone_id(phone_id: str) -> Optional[Dict[str, Any]]:
    return await asyncio.to_thread(_get_clinic_by_whatsapp_phone_id_sync, phone_id)


def _get_patient_by_phone_sync(phone: str, clinic_id: str) -> Optional[Dict[str, Any]]:
    db = get_firestore_client()
    if db is not None:
        try:
            docs = (
                db.collection("patients")
                .where("clinic_id", "==", clinic_id)
                .where("phone", "==", phone)
                .limit(1)
                .stream(timeout=3.0)
            )
            for doc in docs:
                d = doc.to_dict()
                d["patient_id"] = doc.id
                return d
        except Exception as e:
            logger.warning(f"Firestore get_patient_by_phone failed: {e}")

    for k, v in _in_memory_store.items():
        if k.startswith("patients/") and v.get("clinic_id") == clinic_id and v.get("phone") == phone:
            d = dict(v)
            d["patient_id"] = k.split("/")[-1]
            return d
    return None


async def get_patient_by_phone(phone: str, clinic_id: str) -> Optional[Dict[str, Any]]:
    return await asyncio.to_thread(_get_patient_by_phone_sync, phone, clinic_id)


def _get_appointments_today_sync(clinic_id: str, slot_date: str) -> List[Dict[str, Any]]:
    return _query_collection_sync("appointments", [("clinic_id", "==", clinic_id), ("slot_date", "==", slot_date)])


async def get_appointments_today(clinic_id: str, slot_date: str) -> List[Dict[str, Any]]:
    return await asyncio.to_thread(_get_appointments_today_sync, clinic_id, slot_date)


async def get_available_slots(clinic_id: str, slot_date: str) -> List[Dict[str, Any]]:
    clinic = await get_document("clinics", clinic_id)
    if clinic and not clinic.get("is_active"):
        return []
    
    booked = await get_appointments_today(clinic_id, slot_date)
    booked_times = {b.get("slot_time_str") for b in booked if b.get("status") not in ["cancelled", "no_show"]}
    
    default_slots = ["09:00 AM", "09:15 AM", "09:30 AM", "09:45 AM", "10:00 AM", "10:15 AM", "10:30 AM", "10:45 AM", "11:00 AM"]
    available = [s for s in default_slots if s not in booked_times]
    return [{"slot_time_str": s} for s in available]
