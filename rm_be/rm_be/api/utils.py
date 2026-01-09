"""Shared helper functions for API routes."""

from datetime import date, datetime
from typing import Any, Dict, Optional, Union

from bson import ObjectId
from fastapi import HTTPException, status

from rm_be.database import UserRepository


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
