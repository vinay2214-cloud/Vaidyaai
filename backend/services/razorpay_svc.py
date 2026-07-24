import os
import hmac
import hashlib
import logging
import asyncio
from typing import Optional, Dict, Any

try:
    import razorpay
except ImportError:
    razorpay = None

from config import settings

logger = logging.getLogger("vaidyaai.services.razorpay_svc")


class RazorpayService:
    """
    Razorpay Payment Links & Subscription service for VaidyaAI BillingPulse.
    Uses non-blocking execution wrappers over the synchronous razorpay SDK.
    """

    def __init__(self):
        self.key_id = settings.RAZORPAY_KEY_ID
        self.key_secret = settings.RAZORPAY_KEY_SECRET
        self.webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET
        self._client: Optional[Any] = None

    def _get_client(self) -> Any:
        if self._client is None:
            if razorpay is not None:
                self._client = razorpay.Client(auth=(self.key_id, self.key_secret))
            else:
                logger.warning("razorpay package not installed in environment, using mock mode")
                self._client = None
        return self._client

    def _create_payment_link_sync(
        self,
        amount_paise: int,
        description: str,
        customer_phone: str,
        invoice_number: str,
        consultation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        client = self._get_client()

        if client is not None:
            payload = {
                "amount": amount_paise,
                "currency": "INR",
                "accept_partial": False,
                "description": description,
                "customer": {
                    "contact": customer_phone,
                },
                "notify": {
                    "sms": True,
                    "whatsapp": True
                },
                "reminder_enable": True,
                "notes": {
                    "invoice_number": invoice_number,
                    "consultation_id": consultation_id or "",
                },
                "callback_url": f"{settings.BACKEND_URL}/webhook/razorpay",
                "callback_method": "get"
            }

            try:
                res = client.payment_link.create(payload)
                logger.info(f"Created Razorpay payment link '{res.get('id')}' for invoice {invoice_number}")
                return {
                    "payment_link_id": res.get("id"),
                    "payment_link_url": res.get("short_url") or res.get("url"),
                    "short_url": res.get("short_url"),
                    "invoice_number": invoice_number,
                    "raw_response": res
                }
            except Exception as e:
                logger.error(f"Razorpay payment link creation failed for invoice {invoice_number}: {e}")

        # Fallback mock payment link if credentials/SDK not active
        mock_url = f"https://rzp.io/i/mock_{invoice_number}"
        return {
            "payment_link_id": f"plink_mock_{invoice_number}",
            "payment_link_url": mock_url,
            "short_url": mock_url,
            "invoice_number": invoice_number,
            "mock": True
        }

    async def create_payment_link(
        self,
        amount_paise: int,
        description: str,
        customer_phone: str,
        invoice_number: str,
        consultation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Async wrapper for creating a payment link."""
        return await asyncio.to_thread(
            self._create_payment_link_sync,
            amount_paise,
            description,
            customer_phone,
            invoice_number,
            consultation_id
        )

    def verify_payment_signature(self, body_bytes: bytes, signature: str) -> bool:
        """Verifies Razorpay webhook HMAC-SHA256 signature."""
        if not signature or not self.webhook_secret:
            return False
        try:
            expected_signature = hmac.new(
                self.webhook_secret.encode("utf-8"),
                body_bytes,
                hashlib.sha256
            ).hexdigest()
            return hmac.compare_digest(expected_signature, signature)
        except Exception as e:
            logger.error(f"Razorpay webhook signature verification error: {e}")
            return False

    def _get_payment_link_status_sync(self, payment_link_id: str) -> Dict[str, Any]:
        client = self._get_client()
        if client is not None:
            try:
                return client.payment_link.fetch(payment_link_id)
            except Exception as e:
                logger.error(f"Error fetching payment link status for '{payment_link_id}': {e}")
        return {"status": "unknown", "payment_link_id": payment_link_id}

    async def get_payment_link_status(self, payment_link_id: str) -> Dict[str, Any]:
        """Async wrapper to fetch payment link status."""
        return await asyncio.to_thread(self._get_payment_link_status_sync, payment_link_id)

    def _create_subscription_sync(
        self,
        plan_id: str,
        customer_phone: str,
        customer_email: Optional[str] = None
    ) -> Dict[str, Any]:
        client = self._get_client()
        if client is not None:
            payload = {
                "plan_id": plan_id,
                "total_count": 12,
                "quantity": 1,
                "customer_notify": 1,
            }
            try:
                res = client.subscription.create(payload)
                logger.info(f"Created Razorpay subscription '{res.get('id')}'")
                return res
            except Exception as e:
                logger.error(f"Razorpay subscription creation failed: {e}")

        return {"id": f"sub_mock_{plan_id}", "status": "created", "mock": True}

    async def create_subscription(
        self,
        plan_id: str,
        customer_phone: str,
        customer_email: Optional[str] = None
    ) -> Dict[str, Any]:
        """Async wrapper to create clinic subscription."""
        return await asyncio.to_thread(
            self._create_subscription_sync,
            plan_id,
            customer_phone,
            customer_email
        )
