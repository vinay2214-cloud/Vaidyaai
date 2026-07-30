import os
import hmac
import hashlib
import json
import logging
from typing import Optional, Dict, Any, List
import httpx
from config import settings

logger = logging.getLogger("vaidyaai.services.whatsapp")

WHATSAPP_API_URL = "https://graph.facebook.com/v19.0"


class WhatsAppService:
    """
    Meta WhatsApp Cloud API wrapper supporting multi-clinic deployments.
    Credentials can be passed per call or fallback to application defaults.
    """

    def __init__(self):
        self.default_phone_id = settings.WHATSAPP_PHONE_ID
        self.default_token = settings.WHATSAPP_ACCESS_TOKEN
        self.app_secret = settings.WHATSAPP_APP_SECRET

    async def send_text(
        self,
        to: Optional[str] = None,
        message: str = "",
        phone_id: Optional[str] = None,
        access_token: Optional[str] = None,
        to_phone: Optional[str] = None,
        clinic_id: Optional[str] = None
    ) -> Dict[str, Any]:
        target_to = to_phone or to or ""
        return await self._send(
            message_obj={"type": "text", "text": {"body": message, "preview_url": False}},
            to=target_to,
            phone_id=phone_id,
            access_token=access_token
        )

    # Alias for send_text
    async def send_text_message(self, *args, **kwargs):
        return await self.send_text(*args, **kwargs)

    async def send_interactive_list(
        self,
        to: str,
        body: str,
        button_label: str,
        sections: List[Dict[str, Any]],
        phone_id: Optional[str] = None,
        access_token: Optional[str] = None
    ) -> Dict[str, Any]:
        return await self._send(
            message_obj={
                "type": "interactive",
                "interactive": {
                    "type": "list",
                    "body": {"text": body},
                    "action": {"button": button_label, "sections": sections}
                }
            },
            to=to,
            phone_id=phone_id,
            access_token=access_token
        )

    async def send_document(
        self,
        to: str,
        url: str,
        filename: str,
        caption: str,
        phone_id: Optional[str] = None,
        access_token: Optional[str] = None
    ) -> Dict[str, Any]:
        return await self._send(
            message_obj={
                "type": "document",
                "document": {"link": url, "filename": filename, "caption": caption}
            },
            to=to,
            phone_id=phone_id,
            access_token=access_token
        )

    def verify_webhook_signature(self, body: bytes, signature: str) -> bool:
        if not signature or not signature.startswith("sha256="):
            return False
        expected = hmac.new(
            self.app_secret.encode("utf-8"),
            body,
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(f"sha256={expected}", signature)

    def parse_incoming_message(self, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        try:
            entry = payload["entry"][0]["changes"][0]["value"]
            metadata = entry.get("metadata", {})
            phone_number_id = metadata.get("phone_number_id")
            
            messages = entry.get("messages", [])
            if not messages:
                return None
                
            msg = messages[0]
            result = {
                "from_phone": msg["from"],
                "message_id": msg["id"],
                "message_type": msg["type"],
                "timestamp": msg["timestamp"],
                "phone_number_id": phone_number_id,
                "message_text": None,
                "list_reply_id": None,
                "button_reply_id": None,
            }
            
            if msg["type"] == "text":
                result["message_text"] = msg["text"]["body"]
            elif msg["type"] == "interactive":
                itype = msg["interactive"]["type"]
                if itype == "list_reply":
                    result["list_reply_id"] = msg["interactive"]["list_reply"]["id"]
                    result["message_text"] = msg["interactive"]["list_reply"]["title"]
                elif itype == "button_reply":
                    result["button_reply_id"] = msg["interactive"]["button_reply"]["id"]
                    result["message_text"] = msg["interactive"]["button_reply"]["title"]
            return result
        except (KeyError, IndexError, TypeError) as e:
            logger.debug(f"Non-message webhook event or parse error: {e}")
            return None

    async def _send(
        self,
        message_obj: Dict[str, Any],
        to: str,
        phone_id: Optional[str] = None,
        access_token: Optional[str] = None
    ) -> Dict[str, Any]:
        pid = phone_id or self.default_phone_id
        token = access_token or self.default_token
        url = f"{WHATSAPP_API_URL}/{pid}/messages"
        
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            **message_obj
        }
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            last_error: Optional[Exception] = None
            for attempt in range(3):
                try:
                    r = await client.post(url, headers=headers, json=payload, timeout=10.0)
                    r.raise_for_status()
                    return r.json()
                except httpx.HTTPStatusError as e:
                    last_error = e
                    logger.warning(f"WhatsApp API call (attempt {attempt + 1}) returned status {e.response.status_code}.")
                    if e.response.status_code in [401, 403, 404] or attempt == 2:
                        return self._delivery_failure(to, last_error)
                except Exception as e:
                    last_error = e
                    logger.warning(f"WhatsApp API connection error (attempt {attempt + 1}): {e}")
                    if attempt == 2:
                        return self._delivery_failure(to, last_error)

    def _delivery_failure(self, to: str, error: Optional[Exception]) -> Dict[str, Any]:
        """Handle a failed WhatsApp send.

        In development we return a mock success envelope so local flows can be
        exercised without live Meta credentials. In every other environment we
        fail closed and raise so callers never mistake an undelivered message
        for a delivered one.
        """
        if settings.is_development:
            logger.warning("WhatsApp send failed. Using dev mock fallback (development only).")
            return {
                "messaging_product": "whatsapp",
                "contacts": [{"input": to, "wa_id": to}],
                "messages": [{"id": "wamid_mock_id"}]
            }
        logger.error(f"WhatsApp send failed after retries in a non-development environment: {error}")
        raise RuntimeError(f"WhatsApp delivery failed: {error}")
