"""The business date follows the workshop time zone, not the server (UTC)."""

from datetime import UTC, date, datetime

import pytest

from app.config import Settings
from app.core import clock


def test_evening_in_bogota_is_still_the_same_day():
    # 2026-10-28 01:00 UTC == 2026-10-27 20:00 in Bogota (UTC-5)
    late_evening = datetime(2026, 10, 28, 1, 0, tzinfo=UTC)
    assert clock.business_today(late_evening) == date(2026, 10, 27)


def test_morning_matches_utc_date():
    morning = datetime(2026, 10, 28, 14, 0, tzinfo=UTC)  # 09:00 in Bogota
    assert clock.business_today(morning) == date(2026, 10, 28)


def test_time_zone_is_configurable(monkeypatch):
    monkeypatch.setattr(clock.settings, "timezone", "Asia/Tokyo")
    # 2026-10-27 20:00 UTC is already the 28th in Tokyo (UTC+9)
    assert clock.business_today(datetime(2026, 10, 27, 20, 0, tzinfo=UTC)) == date(2026, 10, 28)


def test_invalid_time_zone_is_rejected_at_startup():
    with pytest.raises(ValueError, match="Unknown time zone"):
        Settings(timezone="Mars/Olympus")
