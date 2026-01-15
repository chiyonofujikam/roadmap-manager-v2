"""Shared helper functions for API routes."""

from datetime import date, datetime
from typing import Any, Dict, Optional, Union

from bson import ObjectId
from fastapi import HTTPException, status

from rm_be.database import ConditionalListRepository, UserRepository


async def get_db_user_from_current(current_user: Dict[str, Any], user_repo: UserRepository) -> Dict[str, Any]:
    """
    Resolve the database user document from the current_user payload.

    Tries, in order:
    - email
    - user_id (as ObjectId)
    - name
    Raises HTTPException(404) if no matching user is found.
    """
    db_user: Optional[Dict[str, Any]] = None

    if current_user.get("email"):
        db_user = await user_repo.find_by_email(current_user["email"])

    elif current_user.get("user_id"):
        try:
            user_id = current_user["user_id"]
            if ObjectId.is_valid(user_id):
                db_user = await user_repo.find_by_id(ObjectId(user_id))

        except Exception:
            pass

    if not db_user and current_user.get("name"):
        db_user = await user_repo.find_by_name(current_user["name"])

    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found in database",
        )

    return db_user


async def get_active_lc_name() -> str:
    """
    Get the name of the active conditional list.
    Returns "Default LC" if no active LC is set.
    """
    try:
        repo = ConditionalListRepository()
        system_doc = await repo.collection.find_one({"name": "_SYSTEM_ACTIVE_LC"})
        if system_doc and system_doc.get("active_lc_name"):
            active_name = system_doc.get("active_lc_name")
            lc = await repo.find_by_name(active_name)
            if lc:
                return active_name
    except Exception:
        pass

    return "Default LC"

async def set_active_lc_name(lc_name: str) -> bool:
    """
    Set the active conditional list name.
    Returns True if successful, False otherwise.
    """
    try:
        repo = ConditionalListRepository()
        lc = await repo.find_by_name(lc_name)
        if not lc:
            return False

        await repo.collection.update_one(
            {"name": "_SYSTEM_ACTIVE_LC"},
            {
                "$set": {
                    "active_lc_name": lc_name,
                    "updated_at": datetime.utcnow(),
                }
            },
            upsert=True
        )
        return True

    except Exception:
        return False

def get_cstr_semaine(week_start_date: date) -> str:
    """
    Generate cstr_semaine in SXXYY format from a week start date (Monday).

    Format: S + last 2 digits of year + 2-digit ISO week number
    Example: S2403 for week 3 of 2024

    Args:
        week_start_date: The Monday date of the week

    Returns:
        String in format SXXYY (e.g., "S2403")
    """
    year = week_start_date.year
    year_last_two = year % 100
    iso_week = week_start_date.strftime("%V")
    return f"S{year_last_two:02d}{iso_week}"

def serialize_date(value: Optional[Union[date, datetime, str]]) -> Optional[str]:
    """
    Normalize date/datetime/string values to a YYYY-MM-DD string.

    - datetime -> date().isoformat()
    - date -> isoformat()
    - other truthy values -> str(value)
    - falsy values -> None
    """
    if not value:
        return None

    if isinstance(value, datetime):
        return value.date().isoformat()

    if isinstance(value, date):
        return value.isoformat()

    return str(value)
