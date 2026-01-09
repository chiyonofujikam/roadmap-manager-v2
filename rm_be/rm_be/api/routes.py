"""API routes for the application"""

from datetime import date, datetime, timedelta

from bson import ObjectId
from fastapi import APIRouter, HTTPException, status

from rm_be.api.deps import (CurrentUser, RequireAdminOrResponsible,
                            RequireCollaborator)
from rm_be.api.schemas import PointageEntryCreate, PointageEntryUpdate
from rm_be.api.utils import get_db_user_from_current, serialize_date
from rm_be.database import (ConditionalListRepository, PointageEntry,
                            PointageEntryData, PointageEntryRepository,
                            UserRepository)

router = APIRouter(prefix="/api/v1", tags=["api"])


@router.get("/conditional-lists/default/items")
async def get_default_lc_items(current_user: dict = CurrentUser):
    """
    Get active items from the default LC (Liste Conditionnelle).
    This endpoint is accessible to all authenticated users (collaborators, responsibles, admins).
    Returns the LC items formatted for frontend autocomplete components.
    """
    def format_options(values):
        """Format values as options for AutocompleteInput component"""
        return [
            {
                "id": str(i),
                "label": value,
                "value": value,
                "active": True
            }
            for i, value in enumerate(sorted(values), 1)
        ]

    try:
        repo = ConditionalListRepository()
        default_lc = await repo.find_by_name("Default LC")
        if not default_lc:
            return {
                "clef_imputation": [],
                "libelle": [],
                "fonction": []
            }

        active_items = await repo.find_active_items(default_lc["_id"])
        if not active_items:
            return {
                "clef_imputation": [],
                "libelle": [],
                "fonction": []
            }

        clef_imputation_set = set()
        libelle_set = set()
        fonction_set = set()
        for item in active_items:
            if item.get("clef_imputation"):
                clef_imputation_set.add(item["clef_imputation"])

            if item.get("libelle"):
                libelle_set.add(item["libelle"])

            if item.get("fonction"):
                fonction_set.add(item["fonction"])

        return {
            "clef_imputation": format_options(clef_imputation_set),
            "libelle": format_options(libelle_set),
            "fonction": format_options(fonction_set)
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching LC items: {str(e)}"
        )

@router.get("/pointage/team-entries")
async def get_team_pointage_entries(current_user: dict = RequireAdminOrResponsible(), skip: int = 0, limit: int = 1000):
    """
    Get all pointage entries for a responsible's team.

    For responsible users: Returns entries for their team members only.
    For admin users: Returns entries for all users.
    Returns entries with user information included for table display.

    Args:
        current_user: Authenticated user (admin or responsible)
        skip: Number of entries to skip for pagination
        limit: Maximum number of entries to return

    Returns:
        Dictionary with entries, total count, skip, and limit
    """
    try:
        user_repo = UserRepository()
        pointage_repo = PointageEntryRepository()
        db_user = await get_db_user_from_current(current_user, user_repo)

        user_type = db_user.get("user_type", current_user.get("user_type", ""))
        responsible_id = db_user.get("_id")

        if user_type == "admin":
            entries = await pointage_repo.find_many(
                {"is_deleted": {"$ne": True}},
                skip=skip,
                limit=limit,
                sort=[("entry_data.date_pointage", -1), ("created_at", -1)]
            )
        else:
            entries = await pointage_repo.find_by_team(
                responsible_id,
                skip=skip,
                limit=limit
            )
        user_ids = list(set([entry.get("user_id") for entry in entries if entry.get("user_id")]))
        users_dict = {}

        for user_id in user_ids:
            try:
                if isinstance(user_id, str) and ObjectId.is_valid(user_id):
                    user_obj = await user_repo.find_by_id(ObjectId(user_id))

                elif isinstance(user_id, ObjectId):
                    user_obj = await user_repo.find_by_id(user_id)

                else:
                    continue

                if user_obj:
                    users_dict[str(user_id)] = {
                        "id": str(user_obj.get("_id")),
                        "name": user_obj.get("name", "Unknown"),
                        "email": user_obj.get("email", ""),
                    }

            except Exception:
                continue

        formatted_entries = []
        for entry in entries:
            user_id = str(entry.get("user_id", ""))
            user_info = users_dict.get(user_id, {"name": "Unknown", "email": ""})
            entry_data = entry.get("entry_data", {})
            date_pointage_str = serialize_date(entry_data.get("date_pointage"))
            date_besoin_str = serialize_date(entry_data.get("date_besoin"))

            formatted_entries.append({
                "id": str(entry.get("_id", "")),
                "user_id": user_id,
                "user_name": user_info.get("name", "Unknown"),
                "user_email": user_info.get("email", ""),
                "date_pointage": date_pointage_str,
                "cstr_semaine": entry_data.get("cstr_semaine"),
                "clef_imputation": entry_data.get("clef_imputation", ""),
                "libelle": entry_data.get("libelle", ""),
                "fonction": entry_data.get("fonction", ""),
                "date_besoin": date_besoin_str,
                "heures_theoriques": entry_data.get("heures_theoriques", ""),
                "heures_passees": entry_data.get("heures_passees", ""),
                "commentaires": entry_data.get("commentaires", ""),
                "status": entry.get("status", "draft"),
                "created_at": entry.get("created_at"),
                "updated_at": entry.get("updated_at"),
                "submitted_at": entry.get("submitted_at"),
                "validated_at": entry.get("validated_at"),
            })

        return {
            "entries": formatted_entries,
            "total": len(formatted_entries),
            "skip": skip,
            "limit": limit
        }

    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching team pointage entries: {str(err)}"
        )

@router.get("/pointage/entries/week/{week_start}")
async def get_pointage_entries_for_week(week_start: str, current_user: dict = RequireCollaborator):
    """
    Get all pointage entries for a specific week for the current collaborator.

    Args:
        week_start: Start date of the week in YYYY-MM-DD format (Monday of the week)
        current_user: Authenticated collaborator user

    Returns:
        Dictionary with entries list and week_start date
    """
    try:
        user_repo = UserRepository()
        pointage_repo = PointageEntryRepository()
        db_user = await get_db_user_from_current(current_user, user_repo)
        user_id = db_user.get("_id")
        try:
            week_start_date = datetime.strptime(week_start, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use YYYY-MM-DD"
            )
        cstr_semaine = week_start_date.strftime("%Y-W%V")
        user_id_str = str(user_id) if isinstance(user_id, ObjectId) else user_id
        query = {
            "user_id": {"$in": [user_id, user_id_str]},
            "entry_data.cstr_semaine": cstr_semaine,
            "is_deleted": {"$ne": True},
        }
        entries = await pointage_repo.find_many(query, sort=[("entry_data.date_pointage", 1)])

        formatted_entries = []
        for entry in entries:
            entry_data = entry.get("entry_data", {})
            formatted_entries.append({
                "id": str(entry.get("_id", "")),
                "date_pointage": serialize_date(entry_data.get("date_pointage")),
                "clef_imputation": entry_data.get("clef_imputation", ""),
                "libelle": entry_data.get("libelle", ""),
                "fonction": entry_data.get("fonction", ""),
                "date_besoin": serialize_date(entry_data.get("date_besoin")),
                "heures_theoriques": entry_data.get("heures_theoriques", ""),
                "heures_passees": entry_data.get("heures_passees", ""),
                "commentaires": entry_data.get("commentaires", ""),
                "status": entry.get("status", "draft"),
                "submitted_at": entry.get("submitted_at"),
                "created_at": entry.get("created_at"),
                "updated_at": entry.get("updated_at"),
            })

        return {"entries": formatted_entries, "week_start": week_start}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching pointage entries: {str(e)}"
        )

@router.post("/pointage/entries")
async def create_pointage_entry(entry_data: PointageEntryCreate, current_user: dict = RequireCollaborator):
    """
    Create a new pointage entry for the current collaborator.

    Args:
        entry_data: Pointage entry data (date_pointage, LC fields, hours, etc.)
        current_user: Authenticated collaborator user

    Returns:
        Dictionary with created entry ID, message, and status
    """
    try:
        user_repo = UserRepository()
        pointage_repo = PointageEntryRepository()
        db_user = await get_db_user_from_current(current_user, user_repo)
        user_id = db_user.get("_id")
        try:
            date_pointage_obj = datetime.strptime(entry_data.date_pointage, "%Y-%m-%d").date()
            date_besoin_obj = None
            if entry_data.date_besoin:
                date_besoin_obj = datetime.strptime(entry_data.date_besoin, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use YYYY-MM-DD"
            )

        week_start = date_pointage_obj - timedelta(days=date_pointage_obj.weekday())
        cstr_semaine = week_start.strftime("%Y-W%V")
        pointage_entry_data = PointageEntryData(
            date_pointage=date_pointage_obj,
            cstr_semaine=cstr_semaine,
            clef_imputation=entry_data.clef_imputation,
            libelle=entry_data.libelle,
            fonction=entry_data.fonction,
            date_besoin=date_besoin_obj,
            heures_theoriques=entry_data.heures_theoriques,
            heures_passees=entry_data.heures_passees,
            commentaires=entry_data.commentaires,
        )

        pointage_entry = PointageEntry(
            user_id=user_id,
            entry_data=pointage_entry_data,
            status="draft"
        )

        entry_id = await pointage_repo.create(pointage_entry)

        return {
            "id": str(entry_id),
            "message": "Pointage entry created successfully",
            "status": "draft"
        }

    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating pointage entry: {str(err)}"
        )

@router.put("/pointage/entries/{entry_id}")
async def update_pointage_entry(entry_id: str, entry_data: PointageEntryUpdate, current_user: dict = RequireCollaborator):
    """
    Update an existing pointage entry (only if status is draft).

    Args:
        entry_id: ID of the pointage entry to update
        entry_data: Updated pointage entry data
        current_user: Authenticated collaborator user

    Returns:
        Dictionary with entry ID, message, and updated status
    """
    try:
        user_repo = UserRepository()
        pointage_repo = PointageEntryRepository()
        db_user = await get_db_user_from_current(current_user, user_repo)
        user_id = db_user.get("_id")
        if not ObjectId.is_valid(entry_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid entry ID"
            )

        entry_object_id = ObjectId(entry_id)
        existing_entry = await pointage_repo.find_by_id(entry_object_id)
        if not existing_entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pointage entry not found"
            )

        if existing_entry.get("user_id") != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update your own entries"
            )

        if existing_entry.get("status") == "submitted":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot update submitted entry. It is locked."
            )

        date_besoin_obj = None
        if entry_data.date_besoin:
            try:
                date_besoin_obj = datetime.strptime(entry_data.date_besoin, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid date_besoin format. Use YYYY-MM-DD"
                )

        existing_entry_data = existing_entry.get("entry_data", {})
        existing_date_pointage = existing_entry_data.get("date_pointage")
        if isinstance(existing_date_pointage, str):
            date_pointage_obj = datetime.strptime(existing_date_pointage, "%Y-%m-%d").date()
        elif isinstance(existing_date_pointage, date):
            date_pointage_obj = existing_date_pointage
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date_pointage in existing entry"
            )

        existing_date_besoin = None
        if not date_besoin_obj and existing_entry_data.get("date_besoin"):
            existing_date_besoin_str = existing_entry_data.get("date_besoin")
            if isinstance(existing_date_besoin_str, str):
                existing_date_besoin = datetime.strptime(existing_date_besoin_str, "%Y-%m-%d").date()
            elif isinstance(existing_date_besoin_str, date):
                existing_date_besoin = existing_date_besoin_str

        updated_entry_data = PointageEntryData(
            date_pointage=date_pointage_obj,
            cstr_semaine=existing_entry_data.get("cstr_semaine"),
            clef_imputation=entry_data.clef_imputation if entry_data.clef_imputation is not None else existing_entry_data.get("clef_imputation"),
            libelle=entry_data.libelle if entry_data.libelle is not None else existing_entry_data.get("libelle"),
            fonction=entry_data.fonction if entry_data.fonction is not None else existing_entry_data.get("fonction"),
            date_besoin=date_besoin_obj if date_besoin_obj else existing_date_besoin,
            heures_theoriques=entry_data.heures_theoriques if entry_data.heures_theoriques is not None else existing_entry_data.get("heures_theoriques"),
            heures_passees=entry_data.heures_passees if entry_data.heures_passees is not None else existing_entry_data.get("heures_passees"),
            commentaires=entry_data.commentaires if entry_data.commentaires is not None else existing_entry_data.get("commentaires"),
        )

        new_status = "modified" if existing_entry.get("status") == "draft" else existing_entry.get("status", "draft")
        updated_entry = PointageEntry(
            user_id=user_id,
            entry_data=updated_entry_data,
            status=new_status
        )

        await pointage_repo.update(entry_object_id, updated_entry, current_user.get("email", "system"))
        return {
            "id": entry_id,
            "message": "Pointage entry updated successfully",
            "status": new_status
        }

    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating pointage entry: {str(err)}"
        )

@router.post("/pointage/entries/{entry_id}/submit")
async def submit_pointage_entry(entry_id: str, current_user: dict = RequireCollaborator):
    """
    Submit a pointage entry (locks it for validation).

    Args:
        entry_id: ID of the pointage entry to submit
        current_user: Authenticated collaborator user

    Returns:
        Dictionary with entry ID, message, and submitted status
    """
    try:
        user_repo = UserRepository()
        pointage_repo = PointageEntryRepository()
        db_user = await get_db_user_from_current(current_user, user_repo)
        user_id = db_user.get("_id")
        if not ObjectId.is_valid(entry_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid entry ID"
            )

        entry_object_id = ObjectId(entry_id)
        existing_entry = await pointage_repo.find_by_id(entry_object_id)
        if not existing_entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pointage entry not found"
            )

        if existing_entry.get("user_id") != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only submit your own entries"
            )

        if existing_entry.get("status") == "submitted":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Entry is already submitted"
            )

        await pointage_repo.submit(entry_object_id)
        return {
            "id": entry_id,
            "message": "Pointage entry submitted successfully",
            "status": "submitted"
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error submitting pointage entry: {str(e)}"
        )
