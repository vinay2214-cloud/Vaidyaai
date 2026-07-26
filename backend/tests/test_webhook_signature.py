"""Security tests for webhook signature verification (C-3).

Verifies HMAC signature checks for the Meta WhatsApp and Razorpay webhooks
accept only correctly signed payloads and reject missing/forged signatures.
"""
import hashlib
import hmac

from services.whatsapp import WhatsAppService
from services.razorpay_svc import RazorpayService


def test_whatsapp_valid_signature_accepted():
    svc = WhatsAppService()
    svc.app_secret = "wa_test_secret"
    body = b'{"object":"whatsapp_business_account"}'
    digest = hmac.new(b"wa_test_secret", body, hashlib.sha256).hexdigest()
    assert svc.verify_webhook_signature(body, f"sha256={digest}") is True


def test_whatsapp_forged_signature_rejected():
    svc = WhatsAppService()
    svc.app_secret = "wa_test_secret"
    body = b'{"object":"whatsapp_business_account"}'
    assert svc.verify_webhook_signature(body, "sha256=deadbeef") is False


def test_whatsapp_missing_signature_rejected():
    svc = WhatsAppService()
    svc.app_secret = "wa_test_secret"
    body = b'{"object":"whatsapp_business_account"}'
    assert svc.verify_webhook_signature(body, "") is False
    assert svc.verify_webhook_signature(body, None) is False


def test_whatsapp_signature_wrong_prefix_rejected():
    svc = WhatsAppService()
    svc.app_secret = "wa_test_secret"
    body = b'{"object":"whatsapp_business_account"}'
    digest = hmac.new(b"wa_test_secret", body, hashlib.sha256).hexdigest()
    # Correct digest but missing the required "sha256=" prefix must be rejected.
    assert svc.verify_webhook_signature(body, digest) is False


def test_razorpay_valid_signature_accepted():
    svc = RazorpayService()
    svc.webhook_secret = "rzp_test_secret"
    body = b'{"event":"payment.captured"}'
    expected = hmac.new(b"rzp_test_secret", body, hashlib.sha256).hexdigest()
    assert svc.verify_payment_signature(body, expected) is True


def test_razorpay_forged_signature_rejected():
    svc = RazorpayService()
    svc.webhook_secret = "rzp_test_secret"
    body = b'{"event":"payment.captured"}'
    assert svc.verify_payment_signature(body, "invalid") is False


def test_razorpay_missing_signature_rejected():
    svc = RazorpayService()
    svc.webhook_secret = "rzp_test_secret"
    body = b'{"event":"payment.captured"}'
    assert svc.verify_payment_signature(body, "") is False
    assert svc.verify_payment_signature(body, None) is False
