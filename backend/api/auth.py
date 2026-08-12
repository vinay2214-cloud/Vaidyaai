import asyncio
import hmac
import logging
from typing import Dict, Any, Optional
from fastapi import Depends, HTTPException, Header, status
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth

from config import settings

logger = logging.getLogger("vaidyaai.api.auth")


def ensure_firebase_admin_initialized():
    if not firebase_admin._apps:
        try:
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred, {
                'projectId': settings.FIREBASE_PROJECT_ID
            })
            logger.info("Firebase Admin SDK initialized in auth module with ApplicationDefault credentials")
        except Exception:
            try:
                firebase_admin.initialize_app(options={
                    'projectId': settings.FIREBASE_PROJECT_ID
                })
                logger.info(f"Firebase Admin SDK initialized in auth module for project '{settings.FIREBASE_PROJECT_ID}'")
            except Exception as e:
                logger.warning(f"Firebase Admin SDK init notice in auth module: {e}")


async def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """
    Extract and verify Firebase JWT from Authorization header.
    Runs synchronous verify_id_token off the main thread using asyncio.to_thread.
    Returns: {"uid": str, "clinic_id": str, "role": str, "phone": str}
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing"
        )
        
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header scheme. Must be Bearer token."
        )
    
    token = authorization.replace("Bearer ", "").strip()

    # Security gate: reject dev tokens in production with CRITICAL alert
    if token.startswith("dev_") and settings.is_production:
        logger.critical(f"SECURITY: Dev authentication token attempted in production from {token[:8]}***")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    # Development-only authentication path (STRICTLY disabled when ENVIRONMENT=production)
    if settings.is_development and not settings.is_production and (
        token in ("dev_mock_id_token", "dev_token", "dev_mock_token") or
        token.startswith("dev_")
    ):
        logger.info("Development authentication token recognized. Returning dev doctor context.")
        return {
            "uid": "dev_doctor_001",
            "clinic_id": "cln_e2e_test_clinic",
            "role": "doctor",
            "phone": "+919876543210"
        }

    ensure_firebase_admin_initialized()

    try:
        # Non-blocking execution of synchronous network call
        decoded = await asyncio.to_thread(firebase_auth.verify_id_token, token)
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired"
        )
    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or malformed authentication token"
        )
    except Exception as e:
        logger.error(f"Authentication failure: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate authentication credentials"
        )
    
    uid = decoded["uid"]
    clinic_id = decoded.get("clinic_id")
    role = decoded.get("role")

    if not clinic_id:
        # Fallback: Look up server-side clinic membership in Firestore clinic_users/{uid}
        # to handle propagation delays or tokens minted before custom claims were set.
        try:
            from database.firestore import get_document
            user_doc = await get_document("clinic_users", uid)
            if user_doc and user_doc.get("clinic_id"):
                clinic_id = user_doc.get("clinic_id")
                role = user_doc.get("role", "doctor")
                logger.info(f"Resolved clinic membership '{clinic_id}' for uid '{uid}' via Firestore clinic_users")
        except Exception as e:
            logger.warning(f"Firestore clinic membership lookup warning for {uid}: {e}")

    return {
        "uid": uid,
        "clinic_id": clinic_id,
        "role": role or "doctor",
        "phone": decoded.get("phone_number")
    }


def verify_clinic_access(clinic_id_param: str, current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Verify the authenticated user has access to the requested clinic_id.
    Use as a dependency in any endpoint that takes clinic_id as parameter.
    """
    user_clinic_id = current_user.get("clinic_id")
    if not user_clinic_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No clinic associated with this user account. Please complete onboarding."
        )
        
    if user_clinic_id != clinic_id_param:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: you do not have permission to access this clinic's resources"
        )
    return current_user


async def verify_internal_request(
    x_internal_task_secret: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
) -> None:
    """
    Authenticate requests to /internal/* endpoints invoked by GCP Cloud Tasks /
    Cloud Scheduler. Accepts either:
      - A shared secret in the X-Internal-Task-Secret header matching
        settings.INTERNAL_TASK_SECRET, or
      - A valid Firebase/GCP OIDC bearer token (verified via Firebase Admin).

    Fails closed: in production a misconfigured/placeholder secret is rejected.
    """
    configured_secret = settings.INTERNAL_TASK_SECRET

    if settings.is_production and (
        not configured_secret or configured_secret == "placeholder_internal_secret"
    ):
        logger.error("INTERNAL_TASK_SECRET is not configured in production; rejecting internal request")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Internal task authentication is not configured"
        )

    if x_internal_task_secret and configured_secret and hmac.compare_digest(
        x_internal_task_secret, configured_secret
    ):
        return None

    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "").strip()
        try:
            await asyncio.to_thread(firebase_auth.verify_id_token, token)
            return None
        except Exception as e:
            logger.warning(f"Internal request OIDC verification failed: {e}")

    logger.warning("Rejected unauthenticated /internal request")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized internal request"
    )
