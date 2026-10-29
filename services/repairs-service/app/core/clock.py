"""Business calendar: "today" is the workshop's date, not the server's.

Servers and containers usually run in UTC. In Colombia (UTC-5) that means
after 7 p.m. the server already lives in "tomorrow", so default dates would be
off by one day. Every business date goes through `business_today()`.
"""

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

from app.config import settings


def business_today(now: datetime | None = None) -> date:
    """Today's date in the workshop time zone (REPAIRS_TIMEZONE)."""
    current = now or datetime.now(UTC)
    return current.astimezone(ZoneInfo(settings.timezone)).date()
