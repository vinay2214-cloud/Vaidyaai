from datetime import datetime, timezone, timedelta
from typing import Union

# IST is UTC + 5:30
IST_OFFSET = timedelta(hours=5, minutes=30)
IST_TZ = timezone(IST_OFFSET, name="IST")


def get_current_ist_datetime() -> datetime:
    """Returns current datetime in Indian Standard Time (IST)."""
    return datetime.now(timezone.utc).astimezone(IST_TZ)


def get_today_ist_date_str() -> str:
    """Returns current date in IST formatted as YYYY-MM-DD."""
    return get_current_ist_datetime().strftime("%Y-%m-%d")


def format_display_time(dt: datetime) -> str:
    """Formats datetime as '10:30 AM' in IST."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    ist_dt = dt.astimezone(IST_TZ)
    return ist_dt.strftime("%I:%M %p")


def format_display_date(dt: datetime) -> str:
    """Formats datetime as '24 Jul 2026' in IST."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    ist_dt = dt.astimezone(IST_TZ)
    return ist_dt.strftime("%d %b %Y")


def parse_ist_date(date_str: str) -> datetime:
    """Parses YYYY-MM-DD string into UTC datetime corresponding to start of day in IST."""
    local_dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=IST_TZ)
    return local_dt.astimezone(timezone.utc)
