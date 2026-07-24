import re
from typing import Optional


def normalize_phone(phone: str) -> str:
    """
    Normalizes Indian phone numbers to E.164 format (+91XXXXXXXXXX).
    Examples:
      "9876543210" -> "+919876543210"
      "09876543210" -> "+919876543210"
      "+91 98765 43210" -> "+919876543210"
    """
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("91") and len(digits) == 12:
        return f"+{digits}"
    elif digits.startswith("0") and len(digits) == 11:
        return f"+91{digits[1:]}"
    elif len(digits) == 10:
        return f"+91{digits}"
    elif phone.startswith("+"):
        return phone.replace(" ", "").replace("-", "")
    return f"+91{digits[-10:]}" if len(digits) >= 10 else phone


def mask_phone(phone: str) -> str:
    """
    Masks phone number for logging and display, showing only last 4 digits.
    Example: "+919876543210" -> "XXXXXXX3210"
    """
    digits = re.sub(r"\D", "", phone)
    if len(digits) >= 4:
        return "X" * (len(digits) - 4) + digits[-4:]
    return "XXXX"


def is_valid_indian_phone(phone: str) -> bool:
    """
    Validates if string represents a valid 10-digit Indian mobile number.
    """
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
        
    return len(digits) == 10 and digits[0] in "6789"
