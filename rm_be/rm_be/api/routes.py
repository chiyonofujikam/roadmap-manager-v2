"""API routes for the application"""

from datetime import date, datetime, timedelta

from bson import ObjectId
from fastapi import APIRouter, HTTPException, status

from rm_be.api.deps import (CurrentUser, RequireAdminOrResponsible,
                            RequireCollaborator)
from rm_be.api.schemas import PointageEntryCreate, PointageEntryUpdate
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
    - For responsible users: Returns entries for their team members only
    - For admin users: Returns entries for all users
    Returns entries with user information included for table display.
    """
    try:
        user_repo = UserRepository()
        pointage_repo = PointageEntryRepository()
        db_user = None
        if current_user.get("email"):
            db_user = await user_repo.find_by_email(current_user["email"])

        elif current_user.get("user_id"):
            try:
                if ObjectId.is_valid(current_user["user_id"]):
                    db_user = await user_repo.find_by_id(ObjectId(current_user["user_id"]))
            except:
                pass

        if not db_user and current_user.get("name"):
            db_user = await user_repo.find_by_name(current_user["name"])

        if not db_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found in database"
            )

        user_type = db_user.get("user_type", current_user.get("user_type", ""))
        responsible_id = db_user.get("_id")
        print(f"👤 User type: {user_type}, Responsible ID: {responsible_id}")

        if user_type == "admin":
            print("🔍 Admin: Fetching all entries")
            entries = await pointage_repo.find_many(
                {"is_deleted": False},
                skip=skip,
                limit=limit,
                sort=[("entry_data.date_pointage", -1), ("created_at", -1)]
            )
        else:
            print(f"🔍 Responsible: Fetching team entries for responsible {responsible_id}")
            entries = await pointage_repo.find_by_team(
                responsible_id,
                skip=skip,
                limit=limit
            )

        print(f"✅ Found {len(entries)} entries")
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

            except Exception as e:
                print(f"Error fetching user {user_id}: {e}")
                continue

        formatted_entries = []
        for entry in entries:
            user_id = str(entry.get("user_id", ""))
            user_info = users_dict.get(user_id, {"name": "Unknown", "email": ""})
            entry_data = entry.get("entry_data", {})
            date_pointage = entry_data.get("date_pointage")
            date_besoin = entry_data.get("date_besoin")

            if date_pointage:
                if isinstance(date_pointage, datetime):
                    date_pointage_str = date_pointage.date().isoformat()
                elif isinstance(date_pointage, date):
                    date_pointage_str = date_pointage.isoformat()
                else:
                    date_pointage_str = str(date_pointage)
            else:
                date_pointage_str = None
                
            if date_besoin:
                if isinstance(date_besoin, datetime):
                    date_besoin_str = date_besoin.date().isoformat()
                elif isinstance(date_besoin, date):
                    date_besoin_str = date_besoin.isoformat()
                else:
                    date_besoin_str = str(date_besoin)
            else:
                date_besoin_str = None
            
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
    week_start should be in YYYY-MM-DD format (Monday of the week).
    """
    try:
        user_repo = UserRepository()
        pointage_repo = PointageEntryRepository()
        db_user = None
        if current_user.get("email"):
            db_user = await user_repo.find_by_email(current_user["email"])
        elif current_user.get("user_id"):
            try:
                if ObjectId.is_valid(current_user["user_id"]):
                    db_user = await user_repo.find_by_id(ObjectId(current_user["user_id"]))
            except:
                pass

        if not db_user and current_user.get("name"):
            db_user = await user_repo.find_by_name(current_user["name"])

        if not db_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found in database"
            )

        user_id = db_user.get("_id")
        try:
            week_start_date = datetime.strptime(week_start, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use YYYY-MM-DD"
            )

        week_end_date = week_start_date + timedelta(days=6)
        week_start_datetime = datetime.combine(week_start_date, datetime.min.time())
        week_end_datetime = datetime.combine(week_end_date, datetime.max.time())
        query = {
            "user_id": user_id,
            "is_deleted": False,
            "entry_data.date_pointage": {
                "$gte": week_start_datetime,
                "$lte": week_end_datetime
            }
        }
        print(f"🔍 Querying entries for week: {week_start} to {week_end_date}")
        print(f"🔍 Query datetime range: {week_start_datetime} to {week_end_datetime}")
        print(f"🔍 User ID: {user_id}")
        print(f"🔍 Query: {query}")
        entries = await pointage_repo.find_many(query, sort=[("entry_data.date_pointage", 1)])
        print(f"✅ Found {len(entries)} entries")
        for entry in entries:
            entry_data = entry.get("entry_data", {})
            print(f"  - Entry date: {entry_data.get('date_pointage')}, Status: {entry.get('status')}")

        formatted_entries = []
        for entry in entries:
            entry_data = entry.get("entry_data", {})
            date_pointage = entry_data.get("date_pointage")
            date_besoin = entry_data.get("date_besoin")
            if date_pointage:
                if isinstance(date_pointage, datetime):
                    date_pointage_str = date_pointage.date().isoformat()
                elif isinstance(date_pointage, date):
                    date_pointage_str = date_pointage.isoformat()
                else:
                    date_pointage_str = str(date_pointage)
            else:
                date_pointage_str = None
                
            if date_besoin:
                if isinstance(date_besoin, datetime):
                    date_besoin_str = date_besoin.date().isoformat()
                elif isinstance(date_besoin, date):
                    date_besoin_str = date_besoin.isoformat()
                else:
                    date_besoin_str = str(date_besoin)
            else:
                date_besoin_str = None
            
            formatted_entries.append({
                "id": str(entry.get("_id", "")),
                "date_pointage": date_pointage_str,
                "clef_imputation": entry_data.get("clef_imputation", ""),
                "libelle": entry_data.get("libelle", ""),
                "fonction": entry_data.get("fonction", ""),
                "date_besoin": date_besoin_str,
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
    """Create a new pointage entry for the current collaborator"""
    try:
        user_repo = UserRepository()
        pointage_repo = PointageEntryRepository()
        db_user = None
        if current_user.get("email"):
            db_user = await user_repo.find_by_email(current_user["email"])
        elif current_user.get("user_id"):
            try:
                if ObjectId.is_valid(current_user["user_id"]):
                    db_user = await user_repo.find_by_id(ObjectId(current_user["user_id"]))
            except:
                pass
        
        if not db_user and current_user.get("name"):
            db_user = await user_repo.find_by_name(current_user["name"])
        
        if not db_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found in database"
            )

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
        print(f"✅ Created pointage entry: {entry_id}")
        print(f"  - User ID: {user_id}")
        print(f"  - Date: {date_pointage_obj}")
        print(f"  - Status: draft")

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
    """Update an existing pointage entry (only if status is draft)"""
    try:
        user_repo = UserRepository()
        pointage_repo = PointageEntryRepository()
        db_user = None
        if current_user.get("email"):
            db_user = await user_repo.find_by_email(current_user["email"])
        elif current_user.get("user_id"):
            try:
                if ObjectId.is_valid(current_user["user_id"]):
                    db_user = await user_repo.find_by_id(ObjectId(current_user["user_id"]))
            except:
                pass

        if not db_user and current_user.get("name"):
            db_user = await user_repo.find_by_name(current_user["name"])

        if not db_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found in database"
            )

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
    """Submit a pointage entry (locks it for validation)"""
    try:
        user_repo = UserRepository()
        pointage_repo = PointageEntryRepository()
        db_user = None
        if current_user.get("email"):
            db_user = await user_repo.find_by_email(current_user["email"])
        elif current_user.get("user_id"):
            try:
                if ObjectId.is_valid(current_user["user_id"]):
                    db_user = await user_repo.find_by_id(ObjectId(current_user["user_id"]))
            except:
                pass
        
        if not db_user and current_user.get("name"):
            db_user = await user_repo.find_by_name(current_user["name"])
        
        if not db_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found in database"
            )
        
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
