"""API routes for the application"""

from datetime import date, datetime, timedelta
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Body, HTTPException, status

from rm_be.api.deps import (CurrentUser, RequireAdminOrResponsible,
                            RequireCollaborator)
from rm_be.api.schemas import (ModificationRequestCreate,
                               ModificationRequestReview, PointageEntryCreate,
                               PointageEntryUpdate)
from rm_be.api.utils import get_db_user_from_current, serialize_date
from rm_be.database import (ConditionalListRepository, ModificationRequest,
                            ModificationRequestRepository, PointageEntry,
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
async def get_team_pointage_entries(
    current_user: dict = RequireAdminOrResponsible(), 
    skip: int = 0, 
    limit: int = 1000,
    week_start: Optional[str] = None):
    """
    Get all pointage entries for a responsible's team.

    For responsible users: Returns entries for their team members only.
    For admin users: Returns entries for all users.
    Returns entries with user information included for table display.

    Args:
        current_user: Authenticated user (admin or responsible)
        skip: Number of entries to skip for pagination
        limit: Maximum number of entries to return
        week_start: Optional week start date (YYYY-MM-DD) to filter entries by week

    Returns:
        Dictionary with entries, total count, skip, and limit
    """
    try:
        user_repo = UserRepository()
        pointage_repo = PointageEntryRepository()
        db_user = await get_db_user_from_current(current_user, user_repo)

        user_type = db_user.get("user_type", current_user.get("user_type", ""))
        responsible_id = db_user.get("_id")

        query = {"is_deleted": {"$ne": True}}
        if week_start:
            try:
                week_start_date = datetime.strptime(week_start, "%Y-%m-%d").date()
                cstr_semaine = week_start_date.strftime("%Y-W%V")
                query["entry_data.cstr_semaine"] = cstr_semaine
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid week_start format. Use YYYY-MM-DD"
                )

        if user_type == "admin":
            entries = await pointage_repo.find_many(
                query,
                skip=skip,
                limit=limit,
                sort=[("entry_data.date_pointage", -1), ("created_at", -1)]
            )
        else:
            team_entries = await pointage_repo.find_by_team(
                responsible_id,
                skip=skip,
                limit=limit
            )
            if week_start:
                cstr_semaine = query.get("entry_data.cstr_semaine")
                entries = [e for e in team_entries if e.get("entry_data", {}).get("cstr_semaine") == cstr_semaine]
            else:
                entries = team_entries
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

@router.get("/users/team-members")
async def get_team_members(current_user: dict = RequireAdminOrResponsible()):
    """
    Get all team members for a responsible user.

    For responsible users: Returns their team members (collaborators).
    For admin users: Returns all collaborators.

    Returns:
        List of user dictionaries with id, name, and email
    """
    try:
        user_repo = UserRepository()
        db_user = await get_db_user_from_current(current_user, user_repo)
        user_type = db_user.get("user_type", current_user.get("user_type", ""))
        responsible_id = db_user.get("_id")
        if user_type == "admin":
            team_members = await user_repo.find_many(
                {
                    "user_type": "collaborator",
                    "is_deleted": {"$ne": True}
                },
                skip=0,
                limit=1000,
                sort=[("name", 1)]
            )
        else:
            team_members = await user_repo.find_by_responsible(responsible_id)
        
        formatted_members = []
        for member in team_members:
            formatted_members.append({
                "id": str(member.get("_id", "")),
                "name": member.get("name", "Unknown"),
                "email": member.get("email", ""),
            })
        
        return {"members": formatted_members}

    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching team members: {str(err)}"
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

        existing_user_id = existing_entry.get("user_id")
        existing_user_id_str = str(existing_user_id) if existing_user_id else None
        user_id_str = str(user_id) if user_id else None
        if existing_user_id_str != user_id_str:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update your own entries"
            )

        if existing_entry.get("status") == "submitted":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot update submitted entry. It is locked."
            )

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

        existing_status = existing_entry.get("status", "draft")
        updated_entry = PointageEntry(
            user_id=user_id,
            entry_data=updated_entry_data,
            status=existing_status
        )

        await pointage_repo.update(entry_object_id, updated_entry, current_user.get("email", "system"))
        return {
            "id": entry_id,
            "message": "Pointage entry updated successfully",
            "status": existing_status
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

        existing_user_id = existing_entry.get("user_id")
        existing_user_id_str = str(existing_user_id) if existing_user_id else None
        user_id_str = str(user_id) if user_id else None
        if existing_user_id_str != user_id_str:
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

@router.put("/pointage/entries/{entry_id}/status")
async def update_pointage_entry_status(
    entry_id: str, 
    status_data: dict = Body(...),
    current_user: dict = RequireAdminOrResponsible()):
    """
    Update the status of a pointage entry (for responsible/admin users only).
    
    Args:
        entry_id: ID of the pointage entry to update
        status_data: Dictionary with "status" field (draft, submitted, validated, rejected)
        current_user: Authenticated user (admin or responsible)
    
    Returns:
        Dictionary with entry ID, message, and updated status
    """
    try:
        user_repo = UserRepository()
        pointage_repo = PointageEntryRepository()
        db_user = await get_db_user_from_current(current_user, user_repo)
        
        if not ObjectId.is_valid(entry_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid entry ID"
            )
        
        new_status = status_data.get("status")
        if new_status not in ["draft", "submitted"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status. Must be either 'draft' or 'submitted'"
            )
        
        entry_object_id = ObjectId(entry_id)
        existing_entry = await pointage_repo.find_by_id(entry_object_id)
        if not existing_entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pointage entry not found"
            )
        
        # Update status
        update_dict = {
            "status": new_status,
            "updated_at": datetime.utcnow(),
        }
        
        if new_status == "submitted":
            update_dict["submitted_at"] = datetime.utcnow()

        elif existing_entry.get("status") == "submitted" and new_status == "draft":
            update_dict["submitted_at"] = None
        
        await pointage_repo.collection.update_one(
            {"_id": entry_object_id},
            {"$set": update_dict}
        )
        
        return {
            "id": entry_id,
            "message": f"Entry status updated to {new_status}",
            "status": new_status
        }
    
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating entry status: {str(err)}"
        )

@router.delete("/pointage/entries/{entry_id}")
async def delete_pointage_entry(entry_id: str, current_user: dict = RequireCollaborator):
    """
    Delete a pointage entry (soft delete - marks as deleted).

    Args:
        entry_id: ID of the pointage entry to delete
        current_user: Authenticated collaborator user

    Returns:
        Dictionary with entry ID and message
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
                detail="You can only delete your own entries"
            )

        if existing_entry.get("status") == "submitted":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete submitted entry. It is locked."
            )

        await pointage_repo.mark_as_deleted(entry_object_id, str(user_id))
        return {
            "id": entry_id,
            "message": "Pointage entry deleted successfully"
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting pointage entry: {str(e)}"
        )

@router.post("/pointage/modification-requests")
async def create_modification_request(request_data: ModificationRequestCreate, current_user: dict = RequireCollaborator):
    """
    Create a modification request for a submitted entry.

    Args:
        request_data: Modification request data (entry_id, requested_data, comment)
        current_user: Authenticated collaborator user

    Returns:
        Dictionary with request ID and message
    """
    try:
        user_repo = UserRepository()
        pointage_repo = PointageEntryRepository()
        modification_repo = ModificationRequestRepository()
        db_user = await get_db_user_from_current(current_user, user_repo)
        user_id = db_user.get("_id")

        if not ObjectId.is_valid(request_data.entry_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid entry ID"
            )

        entry_object_id = ObjectId(request_data.entry_id)
        existing_entry = await pointage_repo.find_by_id(entry_object_id)
        if not existing_entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pointage entry not found"
            )

        existing_user_id = existing_entry.get("user_id")
        existing_user_id_str = str(existing_user_id) if existing_user_id else None
        user_id_str = str(user_id) if user_id else None
        if existing_user_id_str != user_id_str:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only request modification for your own entries"
            )
        
        if existing_entry.get("status") != "submitted":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can only request modification for submitted entries"
            )

        existing_requests = await modification_repo.find_many(
            {
                "entry_id": entry_object_id,
                "status": "pending",
                "is_deleted": {"$ne": True}
            }
        )

        if existing_requests:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A pending modification request already exists for this entry"
            )

        modification_request = ModificationRequest(
            entry_id=entry_object_id,
            user_id=user_id,
            requested_data=request_data.requested_data.model_dump(),
            comment=request_data.comment,
            status="pending"
        )

        request_id = await modification_repo.create(modification_request)
        return {
            "id": str(request_id),
            "message": "Modification request created successfully"
        }

    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating modification request: {str(err)}"
        )

@router.get("/pointage/modification-requests")
async def get_modification_requests(
    current_user: dict = RequireAdminOrResponsible(), 
    skip: int = 0, 
    limit: int = 100,
    status: Optional[str] = None):
    """
    Get modification requests for a responsible's team (or all for admin).

    Args:
        current_user: Authenticated user (admin or responsible)
        skip: Number of requests to skip
        limit: Maximum number of requests to return
        status: Optional status filter ("pending", "approved", "rejected"). If None, returns all requests.

    Returns:
        Dictionary with requests list and metadata
    """
    try:
        user_repo = UserRepository()
        modification_repo = ModificationRequestRepository()
        pointage_repo = PointageEntryRepository()
        db_user = await get_db_user_from_current(current_user, user_repo)

        user_type = db_user.get("user_type", current_user.get("user_type", ""))
        responsible_id = db_user.get("_id")
        if user_type == "admin":
            query = {"is_deleted": {"$ne": True}}
            if status:
                query["status"] = status
            requests = await modification_repo.find_many(
                query,
                skip=skip,
                limit=limit,
                sort=[("created_at", -1)]
            )
        else:
            requests = await modification_repo.find_by_team(
                responsible_id,
                skip=skip,
                limit=limit
            )
            if status:
                requests = [r for r in requests if r.get("status") == status]
        
        formatted_requests = []
        for req in requests:
            entry_id = req.get("entry_id")
            user_id = req.get("user_id")
            entry = None
            if entry_id:
                if isinstance(entry_id, str) and ObjectId.is_valid(entry_id):
                    entry = await pointage_repo.find_by_id(ObjectId(entry_id))
                elif isinstance(entry_id, ObjectId):
                    entry = await pointage_repo.find_by_id(entry_id)

            user_info = {"name": "Unknown", "email": ""}
            if user_id:
                try:
                    if isinstance(user_id, str) and ObjectId.is_valid(user_id):
                        user_obj = await user_repo.find_by_id(ObjectId(user_id))
                    elif isinstance(user_id, ObjectId):
                        user_obj = await user_repo.find_by_id(user_id)
                    else:
                        user_obj = None
                    
                    if user_obj:
                        user_info = {
                            "name": user_obj.get("name", "Unknown"),
                            "email": user_obj.get("email", "")
                        }
                except Exception:
                    pass

            entry_data = entry.get("entry_data", {}) if entry else {}
            formatted_requests.append({
                "id": str(req.get("_id", "")),
                "entry_id": str(entry_id) if entry_id else "",
                "user_id": str(user_id) if user_id else "",
                "user_name": user_info.get("name", "Unknown"),
                "user_email": user_info.get("email", ""),
                "requested_data": req.get("requested_data", {}),
                "current_data": {
                    "clef_imputation": entry_data.get("clef_imputation", ""),
                    "libelle": entry_data.get("libelle", ""),
                    "fonction": entry_data.get("fonction", ""),
                    "date_besoin": serialize_date(entry_data.get("date_besoin")),
                    "heures_theoriques": entry_data.get("heures_theoriques", ""),
                    "heures_passees": entry_data.get("heures_passees", ""),
                    "commentaires": entry_data.get("commentaires", ""),
                },
                "date_pointage": serialize_date(entry_data.get("date_pointage")) if entry else "",
                "comment": req.get("comment"),
                "status": req.get("status", "pending"),
                "created_at": req.get("created_at"),
                "reviewed_at": req.get("reviewed_at"),
                "reviewed_by": req.get("reviewed_by"),
                "review_comment": req.get("review_comment"),
            })

        return {
            "requests": formatted_requests,
            "total": len(formatted_requests),
            "skip": skip,
            "limit": limit
        }

    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching modification requests: {str(err)}"
        )

@router.post("/pointage/modification-requests/{request_id}/review")
async def review_modification_request(request_id: str, review_data: ModificationRequestReview, current_user: dict = RequireAdminOrResponsible()):
    """
    Review (approve or reject) a modification request.

    Args:
        request_id: ID of the modification request
        review_data: Review decision (status: "approved" or "rejected", optional review_comment)
        current_user: Authenticated user (admin or responsible)

    Returns:
        Dictionary with request ID and message
    """
    try:
        user_repo = UserRepository()
        pointage_repo = PointageEntryRepository()
        modification_repo = ModificationRequestRepository()
        db_user = await get_db_user_from_current(current_user, user_repo)
        if review_data.status not in ["approved", "rejected"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Status must be 'approved' or 'rejected'"
            )

        if not ObjectId.is_valid(request_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid request ID"
            )

        request_object_id = ObjectId(request_id)
        existing_request = await modification_repo.find_by_id(request_object_id)
        if not existing_request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Modification request not found"
            )

        if existing_request.get("status") != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Request has already been reviewed"
            )

        entry_id = existing_request.get("entry_id")
        if not entry_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid entry ID in request"
            )

        entry_object_id = entry_id if isinstance(entry_id, ObjectId) else ObjectId(entry_id)
        entry = await pointage_repo.find_by_id(entry_object_id)
        if not entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pointage entry not found"
            )

        update_dict = {
            "status": review_data.status,
            "reviewed_at": datetime.utcnow(),
            "reviewed_by": db_user.get("email", current_user.get("email", "system")),
        }
        if review_data.review_comment:
            update_dict["review_comment"] = review_data.review_comment

        await modification_repo.collection.update_one(
            {"_id": request_object_id},
            {"$set": update_dict}
        )

        if review_data.status == "approved":
            requested_data = existing_request.get("requested_data", {})
            existing_entry_data = entry.get("entry_data", {})
            date_besoin_str = requested_data.get("date_besoin")
            if date_besoin_str:
                try:
                    date_besoin_obj = datetime.strptime(date_besoin_str, "%Y-%m-%d").date()
                except ValueError:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid date_besoin format in requested data"
                    )
            else:
                existing_date_besoin = existing_entry_data.get("date_besoin")
                if isinstance(existing_date_besoin, str):
                    date_besoin_obj = datetime.strptime(existing_date_besoin, "%Y-%m-%d").date()
                elif isinstance(existing_date_besoin, date):
                    date_besoin_obj = existing_date_besoin
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid date_besoin in existing entry"
                    )

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

            updated_entry_data = PointageEntryData(
                date_pointage=date_pointage_obj,
                cstr_semaine=existing_entry_data.get("cstr_semaine"),
                clef_imputation=requested_data.get("clef_imputation", existing_entry_data.get("clef_imputation", "")),
                libelle=requested_data.get("libelle", existing_entry_data.get("libelle", "")),
                fonction=requested_data.get("fonction", existing_entry_data.get("fonction", "")),
                date_besoin=date_besoin_obj,
                heures_theoriques=requested_data.get("heures_theoriques", existing_entry_data.get("heures_theoriques", "")),
                heures_passees=requested_data.get("heures_passees", existing_entry_data.get("heures_passees", "")),
                commentaires=requested_data.get("commentaires", existing_entry_data.get("commentaires")),
            )

            updated_entry = PointageEntry(
                user_id=entry.get("user_id"),
                entry_data=updated_entry_data,
                status="draft"
            )
            await pointage_repo.update(entry_object_id, updated_entry, db_user.get("email", "system"))

        return {
            "id": request_id,
            "message": f"Modification request {review_data.status} successfully"
        }

    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reviewing modification request: {str(err)}"
        )

@router.get("/pointage/modification-requests/my-requests")
async def get_my_modification_requests(current_user: dict = RequireCollaborator, skip: int = 0, limit: int = 100):
    """
    Get modification requests for the current collaborator.

    Args:
        current_user: Authenticated collaborator user
        skip: Number of requests to skip
        limit: Maximum number of requests to return

    Returns:
        Dictionary with requests list and metadata
    """
    try:
        user_repo = UserRepository()
        modification_repo = ModificationRequestRepository()
        pointage_repo = PointageEntryRepository()
        db_user = await get_db_user_from_current(current_user, user_repo)
        user_id = db_user.get("_id")

        requests = await modification_repo.find_by_user(
            user_id,
            skip=skip,
            limit=limit
        )

        # Include all requests (pending, approved, rejected)
        formatted_requests = []
        for req in requests:
            entry_id = req.get("entry_id")
            entry = None
            if entry_id:
                if isinstance(entry_id, str) and ObjectId.is_valid(entry_id):
                    entry = await pointage_repo.find_by_id(ObjectId(entry_id))
                elif isinstance(entry_id, ObjectId):
                    entry = await pointage_repo.find_by_id(entry_id)

            entry_data = entry.get("entry_data", {}) if entry else {}
            requested_data = req.get("requested_data", {})
            formatted_requests.append({
                "id": str(req.get("_id", "")),
                "entry_id": str(entry_id) if entry_id else "",
                "status": req.get("status", ""),
                "review_comment": req.get("review_comment"),
                "reviewed_at": req.get("reviewed_at"),
                "created_at": req.get("created_at"),
                "date_pointage": serialize_date(entry_data.get("date_pointage")) if entry else "",
                "cstr_semaine": entry_data.get("cstr_semaine") if entry else "",
                "requested_data": requested_data,
                "current_data": {
                    "clef_imputation": entry_data.get("clef_imputation", ""),
                    "libelle": entry_data.get("libelle", ""),
                    "fonction": entry_data.get("fonction", ""),
                    "date_besoin": serialize_date(entry_data.get("date_besoin")),
                    "heures_theoriques": entry_data.get("heures_theoriques", ""),
                    "heures_passees": entry_data.get("heures_passees", ""),
                    "commentaires": entry_data.get("commentaires", ""),
                },
                "comment": req.get("comment"),
            })

        return {
            "requests": formatted_requests,
            "total": len(formatted_requests),
            "skip": skip,
            "limit": limit
        }

    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching modification requests: {str(err)}"
        )
