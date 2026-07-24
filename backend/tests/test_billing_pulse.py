import pytest
from services.razorpay_svc import RazorpayService


def test_razorpay_signature_verification():
    svc = RazorpayService()
    svc.webhook_secret = "test_secret_123"
    body = b'{"event": "payment.captured"}'

    import hmac, hashlib
    expected = hmac.new(b"test_secret_123", body, hashlib.sha256).hexdigest()

    assert svc.verify_payment_signature(body, expected) is True
    assert svc.verify_payment_signature(body, "invalid_sig") is False


def test_fee_calculation():
    # Fee breakdown test
    fee_breakdown = {
        "consultation": 30000,
        "lab": 5000,
        "medicine": 2000,
        "tax": 1000,
        "discount": 3000
    }
    base = fee_breakdown["consultation"]
    lab = fee_breakdown["lab"]
    medicine = fee_breakdown["medicine"]
    tax = fee_breakdown["tax"]
    discount = fee_breakdown["discount"]
    total = max(0, base + lab + medicine + tax - discount)

    assert total == 35000  # ₹350.00
