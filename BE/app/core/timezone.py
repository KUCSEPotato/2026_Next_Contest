from datetime import datetime, timedelta, timezone


KST = timezone(timedelta(hours=9), name="KST")


def now_kst() -> datetime:
    return datetime.now(KST)


def as_kst(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(KST)
