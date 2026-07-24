import os
import logging
import asyncio
from typing import Optional, List, Dict, Any
import firebase_admin
from firebase_admin import credentials, firestore
from config import settings

logger = logging.getLogger("vaidyaai.database.firestore")

_db: Optional[Any] = None
_in_memory_store: Dict[str, Dict[str, Any]] = {}


async def init_firestore():
    global _db
    if not firebase_admin._apps:
        try:
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred, {
                'projectId': settings.FIREBASE_PROJECT_ID
            })
            logger.info("Firebase Admin SDK initialized with ApplicationDefault credentials")
        except Exception as e:
            logger.warning(f"Default application credentials fallback: {e}")
            try:
                firebase_admin.initialize_app(options={
                    'projectId': settings.FIREBASE_PROJECT_ID
                })
            except Exception:
                pass
    try:
        _db = firestore.client()
    except Exception as e:
        logger.warning(f"Could not connect to live Firestore: {e}. Using in-memory fallback store.")
        _db = None
    return _db


def get_firestore_client():
    global _db
    if _db is None:
        if not firebase_admin._apps:
            try:
                firebase_admin.initialize_app(options={
                    'projectId': settings.FIREBASE_PROJECT_ID
                })
            except Exception:
                pass
        try:
            _db = firestore.client()
        except Exception as e:
            logger.warning(f"Firestore client init fallback: {e}")
            _db = None
    return _db


def _get_document_sync(collection_name: str, doc_id: str) -> Optional[Dict[str, Any]]:
    db = get_firestore_client()
    if db is not None:
        try:
            doc_ref = db.collection(collection_name).document(doc_id)
            doc = doc_ref.get()
            if doc.exists:
                data = doc.to_dict()
                data["id"] = doc.id
                return data
        except Exception as e:
            logger.warning(f"Firestore sync get_document failed: {e}. Checking in-memory fallback.")

    key = f"{collection_name}/{doc_id}"
    return _in_memory_store.get(key)


async def get_document(collection_name: str, doc_id: str) -> Optional[Dict[str, Any]]:
    return await asyncio.to_thread(_get_document_sync, collection_name, doc_id)


def _set_document_sync(collection_name: str, doc_id: str, data: Dict[str, Any], merge: bool = True) -> None:
    key = f"{collection_name}/{doc_id}"
    if merge and key in _in_memory_store:
        _in_memory_store[key].update(data)
    else:
        _in_memory_store[key] = dict(data)

    db = get_firestore_client()
    if db is not None:
        try:
            doc_ref = db.collection(collection_name).document(doc_id)
            doc_ref.set(data, merge=merge)
        except Exception as e:
            logger.warning(f"Firestore set_document live write failed: {e}")


async def set_document(collection_name: str, doc_id: str, data: Dict[str, Any], merge: bool = True) -> None:
    await asyncio.to_thread(_set_document_sync, collection_name, doc_id, data, merge)


def _update_document_sync(collection_name: str, doc_id: str, data: Dict[str, Any]) -> None:
    key = f"{collection_name}/{doc_id}"
    if key in _in_memory_store:
        _in_memory_store[key].update(data)
    else:
        _in_memory_store[key] = dict(data)

    db = get_firestore_client()
    if db is not None:
        try:
            doc_ref = db.collection(collection_name).document(doc_id)
            doc_ref.update(data)
        except Exception as e:
            logger.warning(f"Firestore update_document live write failed: {e}")


async def update_document(collection_name: str, doc_id: str, data: Dict[str, Any]) -> None:
    await asyncio.to_thread(_update_document_sync, collection_name, doc_id, data)


def _query_collection_sync(collection_name: str, filters: List[tuple], limit: Optional[int] = None) -> List[Dict[str, Any]]:
    db = get_firestore_client()
    if db is not None:
        try:
            query = db.collection(collection_name)
            for field, op, val in filters:
                query = query.where(field, op, val)
            if limit:
                query = query.limit(limit)
            docs = query.stream()
            result = []
            for doc in docs:
                d = doc.to_dict()
                d["id"] = doc.id
                result.append(d)
            return result
        except Exception as e:
            logger.warning(f"Firestore query_collection live search failed: {e}. Falling back to in-memory store.")

    # In-memory query fallback
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
                if limit and len(res) >= limit:
                    break
    return res


async def query_collection(collection_name: str, filters: List[tuple], limit: Optional[int] = None) -> List[Dict[str, Any]]:
    return await asyncio.to_thread(_query_collection_sync, collection_name, filters, limit)

query_documents = query_collection


def _get_clinic_by_whatsapp_phone_id_sync(phone_id: str) -> Optional[Dict[str, Any]]:
    db = get_firestore_client()
    if db is not None:
        try:
            docs = db.collection("clinics").where("whatsapp_phone_id", "==", phone_id).limit(1).stream()
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
                .stream()
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
