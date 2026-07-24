import logging
from fastapi import APIRouter, Request, Response, HTTPException, Header, status
from services.whatsapp import WhatsAppService
from services.razorpay_svc import RazorpayService
from database.firestore import get_clinic_by_whatsapp_phone_id
from agents.appointment_flow import AppointmentFlowAgent
from agents.billing_pulse import BillingPulseAgent
from config import settings

logger = logging.getLogger("vaidyaai.api.webhooks")
router = APIRouter()

whatsapp_service = WhatsAppService()
razorpay_service = RazorpayService()
appointment_flow_agent = AppointmentFlowAgent()
billing_pulse_agent = BillingPulseAgent()


@router.get("/webhook/whatsapp", tags=["webhooks"])
async def verify_whatsapp_webhook(request: Request):
    """
    GET /webhook/whatsapp
    Meta WhatsApp Cloud API Webhook Verification Endpoint.
    """
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    if mode == "subscribe" and token == settings.WHATSAPP_VERIFY_TOKEN:
        logger.info("WhatsApp webhook verified successfully")
        return Response(content=challenge, media_type="text/plain")

    logger.warning(f"WhatsApp webhook verification failed: mode={mode}, token={token}")
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Verification token mismatch"
    )


@router.post("/webhook/whatsapp", tags=["webhooks"])
async def receive_whatsapp_webhook(
    request: Request,
    x_hub_signature_256: str = Header(None)
):
    """
    POST /webhook/whatsapp
    Meta WhatsApp Cloud API Webhook Event Receiver.
    Validates HMAC-SHA256 signature and routes incoming messages to AppointmentFlowAgent.
    Always returns 200 OK immediately for async processing.
    """
    body = await request.body()

    if x_hub_signature_256:
        if not whatsapp_service.verify_webhook_signature(body, x_hub_signature_256):
            logger.warning("WhatsApp webhook signature validation failed")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid signature"
            )

    payload = await request.json()
    parsed_msg = whatsapp_service.parse_incoming_message(payload)

    if not parsed_msg:
        return {"status": "ignored"}

    phone_number_id = parsed_msg.get("phone_number_id")
    from_phone = parsed_msg.get("from_phone")
    message_text = parsed_msg.get("message_text") or ""
    list_reply_id = parsed_msg.get("list_reply_id")

    clinic = None
    if phone_number_id:
        clinic = await get_clinic_by_whatsapp_phone_id(phone_number_id)

    clinic_id = clinic.get("clinic_id") if clinic else "demo_clinic_id"
    phone_id = clinic.get("whatsapp_phone_id") if clinic else settings.WHATSAPP_PHONE_ID
    access_token = clinic.get("whatsapp_access_token") if clinic else settings.WHATSAPP_ACCESS_TOKEN

    try:
        await appointment_flow_agent.handle_incoming_message(
            from_phone=from_phone,
            message=message_text,
            clinic_id=clinic_id,
            phone_id=phone_id,
            access_token=access_token,
            list_reply_id=list_reply_id
        )
    except Exception as e:
        logger.error(f"Error processing WhatsApp message from {from_phone}: {e}", exc_info=True)

    return {"status": "received"}


@router.post("/webhook/razorpay", tags=["webhooks"])
async def receive_razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(None)
):
    """
    POST /webhook/razorpay
    Razorpay payment captured / payment_link.paid webhook event endpoint.
    Validates HMAC signature and confirms payment with BillingPulseAgent.
    """
    body = await request.body()

    if x_razorpay_signature and settings.RAZORPAY_WEBHOOK_SECRET != "placeholder_webhook_secret":
        if not razorpay_service.verify_payment_signature(body, x_razorpay_signature):
            logger.warning("Razorpay webhook signature verification failed")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Razorpay signature"
            )

    try:
        payload = await request.json()
        event = payload.get("event")
        logger.info(f"Razorpay webhook event: {event}")

        if event in ["payment_link.paid", "payment.captured"]:
            entity = payload.get("payload", {}).get("payment_link", {}).get("entity", {})
            if not entity:
                entity = payload.get("payload", {}).get("payment", {}).get("entity", {})

            payment_link_id = entity.get("id") or entity.get("payment_link_id")
            amount_paise = entity.get("amount") or entity.get("amount_paid", 0)
            payment_id = entity.get("payment_id") or entity.get("id")

            if payment_link_id:
                await billing_pulse_agent.on_payment_confirmed(
                    razorpay_payment_link_id=payment_link_id,
                    amount_paise=amount_paise,
                    razorpay_payment_id=payment_id or "pay_unknown",
                    payment_method="upi"
                )

        return {"status": "processed", "event": event}
    except Exception as e:
        logger.error(f"Error handling Razorpay webhook: {e}", exc_info=True)
        return {"status": "error", "detail": str(e)}
