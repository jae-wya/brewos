"""Day boundaries in the business's own timezone.

`created_at` is stored in UTC. "Today" for a café in Los Baños starts at
midnight Asia/Manila (16:00 UTC the previous day), not midnight UTC. Every
query that filters by day must get its bounds from here.
"""
from datetime import date, datetime, time, timedelta
from typing import Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException


def get_business_tz(supabase, business_id: str) -> ZoneInfo:
    res = supabase.table("businesses")\
        .select("timezone")\
        .eq("id", business_id)\
        .is_("deleted_at", None)\
        .limit(1)\
        .execute()

    tz_name = res.data[0].get("timezone") if res.data else None
    try:
        return ZoneInfo(tz_name)
    except (ZoneInfoNotFoundError, TypeError, ValueError):
        # Fail loudly — silently falling back to UTC is the bug this replaces.
        raise HTTPException(status_code=500, detail=f"Business has no valid timezone: {tz_name!r}")


def local_today(tz: ZoneInfo) -> date:
    return datetime.now(tz).date()


def day_bounds(tz: ZoneInfo, day: Optional[date] = None) -> tuple[str, str]:
    """[start, end) of a local calendar day, as UTC-offset ISO strings for
    `.gte("created_at", start).lt("created_at", end)`."""
    day = day or local_today(tz)
    start = datetime.combine(day, time.min, tzinfo=tz)
    # Add a day on the calendar, not 24h, so DST zones still get a whole day.
    end = datetime.combine(day + timedelta(days=1), time.min, tzinfo=tz)
    return start.isoformat(), end.isoformat()
