"""Database repositories for CRUD operations - Simplified Schema"""

from datetime import date, datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from .connection import get_database
from .models import (AuditLog, BackgroundJob, ConditionalList,
                     ModificationRequest, PointageEntry, User)


class BaseRepository:
    """Base repository with common operations"""

    def __init__(self, collection_name: str):
        self.collection_name = collection_name

    @property
    def collection(self):
        """Get collection from database"""
        db = get_database()
        return db[self.collection_name]

    async def find_by_id(self, document_id: ObjectId) -> Optional[Dict[str, Any]]:
        """Find document by ID"""
        return await self.collection.find_one({"_id": document_id})

    async def find_one(self, filter_dict: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Find one document matching filter"""
        return await self.collection.find_one(filter_dict)

    async def find_many(self, filter_dict: Optional[Dict[str, Any]] = None, skip: int = 0, limit: int = 100,  sort: Optional[List[tuple]] = None) -> List[Dict[str, Any]]:
        """Find many documents matching filter"""
        if filter_dict is None:
            filter_dict = {}

        cursor = self.collection.find(filter_dict)
        if sort:
            cursor = cursor.sort(sort)

        cursor = cursor.skip(skip).limit(limit)
        return await cursor.to_list(length=limit)

    async def count(self, filter_dict: Optional[Dict[str, Any]] = None) -> int:
        """Count documents matching filter"""
        if filter_dict is None:
            filter_dict = {}
        return await self.collection.count_documents(filter_dict)

    async def delete_by_id(self, document_id: ObjectId) -> bool:
        """Hard delete document by ID (use with caution)"""
        result = await self.collection.delete_one({"_id": document_id})
        return result.deleted_count > 0


class UserRepository(BaseRepository):
    """
    Repository for users collection

    Users can be one of three types:
    - collaborator: Fills pointage entries via dedicated frontend page
    - responsible: Manages team, views pointage data, updates LC
    - admin: Full access, can import data and perform cleanup

    Collaborators are linked to responsibles via responsible_id field.
    """
    def __init__(self):
        super().__init__("users")

    async def create(self, user: User) -> ObjectId:
        """Create a new user"""
        doc = user.model_dump(by_alias=True, exclude={"id"})
        doc["_id"] = ObjectId()
        doc["created_at"] = datetime.utcnow()
        doc["updated_at"] = datetime.utcnow()

        # Ensure responsible_id is stored as ObjectId, not string
        if "responsible_id" in doc and doc["responsible_id"]:
            if isinstance(doc["responsible_id"], str) and ObjectId.is_valid(doc["responsible_id"]):
                doc["responsible_id"] = ObjectId(doc["responsible_id"])
            elif not isinstance(doc["responsible_id"], ObjectId):
                raise ValueError(f"Invalid responsible_id type: {type(doc['responsible_id'])}")

        try:
            result = await self.collection.insert_one(doc)
            return result.inserted_id

        except DuplicateKeyError as e:
            raise ValueError(f"User with name '{user.name}' already exists") from e

    async def update(self, document_id: ObjectId, user: User, updated_by: str) -> bool:
        """Update user"""
        doc = user.model_dump(by_alias=True, exclude={"id", "created_at", "created_by"})
        doc["updated_at"] = datetime.utcnow()
        doc["updated_by"] = updated_by

        # Ensure responsible_id is stored as ObjectId, not string
        if "responsible_id" in doc and doc["responsible_id"]:
            if isinstance(doc["responsible_id"], str) and ObjectId.is_valid(doc["responsible_id"]):
                doc["responsible_id"] = ObjectId(doc["responsible_id"])
            elif not isinstance(doc["responsible_id"], ObjectId):
                raise ValueError(f"Invalid responsible_id type: {type(doc['responsible_id'])}")

        result = await self.collection.update_one(
            {"_id": document_id}, {"$set": doc}
        )
        return result.modified_count > 0

    async def mark_as_deleted(self, document_id: ObjectId, updated_by: str) -> bool:
        """Mark user as deleted (visualization flag only)"""
        result = await self.collection.update_one(
            {"_id": document_id},
            {
                "$set": {
                    "is_deleted": True,
                    "updated_at": datetime.utcnow(),
                    "updated_by": updated_by,
                }
            },
        )
        return result.modified_count > 0

    async def mark_as_archived(self, document_id: ObjectId, updated_by: str) -> bool:
        """Mark user as archived (visualization flag only)"""
        result = await self.collection.update_one(
            {"_id": document_id},
            {
                "$set": {
                    "is_archived": True,
                    "updated_at": datetime.utcnow(),
                    "updated_by": updated_by,
                }
            },
        )
        return result.modified_count > 0

    async def restore(self, document_id: ObjectId, updated_by: str) -> bool:
        """Restore user (clear deletion/archival flags)"""
        result = await self.collection.update_one(
            {"_id": document_id},
            {
                "$set": {
                    "is_deleted": False,
                    "is_archived": False,
                    "updated_at": datetime.utcnow(),
                    "updated_by": updated_by,
                }
            },
        )
        return result.modified_count > 0

    async def find_active(self, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """Find active users (not deleted, not archived)"""
        return await self.find_many(
            {"status": "active", "is_deleted": False, "is_archived": False},
            skip=skip,
            limit=limit,
            sort=[("name", 1)],
        )

    async def find_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Find user by name (case-insensitive)"""
        return await self.collection.find_one(
            {"name": {"$regex": f"^{name}$", "$options": "i"}}
        )

    async def find_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Find user by email"""
        return await self.collection.find_one({"email": email.lower()})

    async def find_by_responsible(self, responsible_id: ObjectId, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """Find all collaborators managed by a responsible"""
        # Handle both ObjectId and string responsible_id (for backward compatibility)
        responsible_id_str = str(responsible_id) if isinstance(responsible_id, ObjectId) else responsible_id
        return await self.find_many(
            {
                "responsible_id": {"$in": [responsible_id, responsible_id_str]},
                "user_type": "collaborator",
                "is_deleted": {"$ne": True},  # Use $ne: True to handle missing field
            },
            skip=skip,
            limit=limit,
            sort=[("name", 1)],
        )

    async def find_responsibles(self, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """Find all responsible users"""
        return await self.find_many(
            {
                "user_type": "responsible",
                "is_deleted": False,
            },
            skip=skip,
            limit=limit,
            sort=[("name", 1)],
        )


class ConditionalListRepository(BaseRepository):
    """
    Repository for conditional_lists collection

    LC (Liste Conditionnelle) provides reference data for pointage entries.
    Admin and Responsible users can:
    - Add/remove LC items
    - Activate/deactivate LC items (each field can be managed independently)
    - Update LC item values

    LC items are used in the pointage filling interface where collaborators
    select values from these fields when creating pointage entries.
    """
    def __init__(self):
        super().__init__("conditional_lists")

    async def create(self, conditional_list: ConditionalList) -> ObjectId:
        """Create a new conditional list"""
        doc = conditional_list.model_dump(by_alias=True, exclude={"id"})
        doc["_id"] = ObjectId()
        doc["created_at"] = datetime.utcnow()
        doc["updated_at"] = datetime.utcnow()

        result = await self.collection.insert_one(doc)
        return result.inserted_id

    async def update(self, document_id: ObjectId, conditional_list: ConditionalList, updated_by: str) -> bool:
        """Update conditional list"""
        doc = conditional_list.model_dump(by_alias=True, exclude={"id", "created_at", "created_by"})
        doc["updated_at"] = datetime.utcnow()
        doc["updated_by"] = updated_by

        result = await self.collection.update_one(
            {"_id": document_id}, {"$set": doc}
        )
        return result.modified_count > 0

    async def update_item_status(self, document_id: ObjectId, item_index: int, is_active: bool, updated_by: str) -> bool:
        """
        Update active status of a specific LC item (responsible/admin can activate/deactivate)

        Note: Each field (clef_imputation, libelle, fonction) can be independently
        activated/deactivated. This method updates the entire item's is_active status.
        For field-level activation, use a separate method or update the item directly.
        """
        result = await self.collection.update_one(
            {"_id": document_id},
            {
                "$set": {
                    f"items.{item_index}.is_active": is_active,
                    "updated_at": datetime.utcnow(),
                    "updated_by": updated_by,
                }
            },
        )
        return result.modified_count > 0

    async def add_item(self, document_id: ObjectId, item: Dict[str, Any], updated_by: str) -> bool:
        """Add a new item to conditional list (responsible can add new entries)"""
        result = await self.collection.update_one(
            {"_id": document_id},
            {
                "$push": {"items": item},
                "$set": {
                    "updated_at": datetime.utcnow(),
                    "updated_by": updated_by,
                }
            },
        )
        return result.modified_count > 0

    async def mark_as_deleted(self, document_id: ObjectId, updated_by: str) -> bool:
        """Mark conditional list as deleted (visualization flag only)"""
        result = await self.collection.update_one(
            {"_id": document_id},
            {
                "$set": {
                    "is_deleted": True,
                    "updated_at": datetime.utcnow(),
                    "updated_by": updated_by,
                }
            },
        )
        return result.modified_count > 0

    async def mark_as_archived(self, document_id: ObjectId, updated_by: str) -> bool:
        """Mark conditional list as archived (visualization flag only)"""
        result = await self.collection.update_one(
            {"_id": document_id},
            {
                "$set": {
                    "is_archived": True,
                    "updated_at": datetime.utcnow(),
                    "updated_by": updated_by,
                }
            },
        )
        return result.modified_count > 0

    async def find_active_lists(self, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """Find active conditional lists (not deleted, not archived)"""
        return await self.find_many(
            {"is_deleted": False, "is_archived": False},
            skip=skip,
            limit=limit,
            sort=[("name", 1)],
        )

    async def find_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Find conditional list by name"""
        return await self.collection.find_one(
            {"name": name, "is_deleted": False}
        )

    async def find_active_items(self, document_id: ObjectId) -> List[Dict[str, Any]]:
        """Find only active items in a conditional list"""
        doc = await self.find_by_id(document_id)
        if not doc:
            return []

        return [item for item in doc.get("items", []) if item.get("is_active", True)]


class PointageEntryRepository(BaseRepository):
    """
    Repository for pointage_entries collection

    Pointage entries are filled by collaborators through a dedicated frontend page.
    Each user has a weekly calendar view where they can:
    - Fill pointage entries for each day of the week
    - Select values from Conditional List (LC) fields
    - Save entries as draft (editable)
    - Submit entries for validation (locked)

    Responsible users can view all pointage entries via export_pointage job.
    """
    def __init__(self):
        super().__init__("pointage_entries")

    async def create(self, pointage_entry: PointageEntry) -> ObjectId:
        """Create a new pointage entry (filled by collaborator)"""
        doc = pointage_entry.model_dump(by_alias=True, exclude={"id"})
        doc["_id"] = ObjectId()
        doc["created_at"] = datetime.utcnow()
        doc["updated_at"] = datetime.utcnow()

        # Ensure user_id is stored as ObjectId, not string
        if "user_id" in doc:
            if isinstance(doc["user_id"], str) and ObjectId.is_valid(doc["user_id"]):
                doc["user_id"] = ObjectId(doc["user_id"])
            elif not isinstance(doc["user_id"], ObjectId):
                raise ValueError(f"Invalid user_id type: {type(doc['user_id'])}")

        if "entry_data" in doc and doc["entry_data"]:

            entry_data = doc["entry_data"]
            if "date_pointage" in entry_data and isinstance(entry_data["date_pointage"], date):
                entry_data["date_pointage"] = datetime.combine(entry_data["date_pointage"], datetime.min.time())

            if "date_besoin" in entry_data and entry_data["date_besoin"] and isinstance(entry_data["date_besoin"], date):
                entry_data["date_besoin"] = datetime.combine(entry_data["date_besoin"], datetime.min.time())

        result = await self.collection.insert_one(doc)
        return result.inserted_id

    async def update(self, document_id: ObjectId, pointage_entry: PointageEntry, updated_by: str) -> bool:
        """Update pointage entry"""
        doc = pointage_entry.model_dump(by_alias=True, exclude={"id", "created_at", "created_by"})
        doc["updated_at"] = datetime.utcnow()
        if "entry_data" in doc and doc["entry_data"]:

            entry_data = doc["entry_data"]
            if "date_pointage" in entry_data and isinstance(entry_data["date_pointage"], date):
                entry_data["date_pointage"] = datetime.combine(entry_data["date_pointage"], datetime.min.time())

            if "date_besoin" in entry_data and entry_data["date_besoin"] and isinstance(entry_data["date_besoin"], date):
                entry_data["date_besoin"] = datetime.combine(entry_data["date_besoin"], datetime.min.time())

        result = await self.collection.update_one(
            {"_id": document_id}, {"$set": doc}
        )
        return result.modified_count > 0

    async def mark_as_deleted(self, document_id: ObjectId, deleted_by: str) -> bool:
        """Mark pointage entry as deleted (visualization flag only)"""
        result = await self.collection.update_one(
            {"_id": document_id},
            {
                "$set": {
                    "is_deleted": True,
                    "updated_at": datetime.utcnow(),
                }
            },
        )
        return result.modified_count > 0

    async def mark_as_archived(self, document_id: ObjectId, archived_by: str) -> bool:
        """Mark pointage entry as archived (visualization flag only)"""
        result = await self.collection.update_one(
            {"_id": document_id},
            {
                "$set": {
                    "is_archived": True,
                    "updated_at": datetime.utcnow(),
                }
            },
        )
        return result.modified_count > 0

    async def submit(self, document_id: ObjectId) -> bool:
        """Mark entry as submitted"""
        result = await self.collection.update_one(
            {"_id": document_id},
            {
                "$set": {
                    "status": "submitted",
                    "submitted_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                }
            },
        )
        return result.modified_count > 0

    async def validate(self, document_id: ObjectId, validated_by: str) -> bool:
        """Mark entry as validated"""
        result = await self.collection.update_one(
            {"_id": document_id},
            {
                "$set": {
                    "status": "validated",
                    "validated_at": datetime.utcnow(),
                    "validated_by": validated_by,
                    "updated_at": datetime.utcnow(),
                }
            },
        )
        return result.modified_count > 0

    async def reject(self, document_id: ObjectId, rejected_by: str) -> bool:
        """Mark entry as rejected"""
        result = await self.collection.update_one(
            {"_id": document_id},
            {
                "$set": {
                    "status": "rejected",
                    "updated_at": datetime.utcnow(),
                }
            },
        )
        return result.modified_count > 0

    async def find_by_user(self, user_id: ObjectId, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """Find entries by collaborator (not deleted)"""
        return await self.find_many(
            {
                "user_id": user_id,
                "is_deleted": False,
            },
            skip=skip,
            limit=limit,
            sort=[("entry_data.date", -1)],
        )

    async def find_by_team(self, responsible_id: ObjectId, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Find entries for all collaborators in a responsible's team.

        Args:
            responsible_id: ObjectId of the responsible user
            skip: Number of entries to skip for pagination
            limit: Maximum number of entries to return

        Returns:
            List of pointage entry dictionaries
        """
        user_repo = UserRepository()
        team_members = await user_repo.find_by_responsible(responsible_id)
        team_user_ids = [member["_id"] for member in team_members]

        if not team_user_ids:
            return []

        team_user_ids_with_strings = []
        for uid in team_user_ids:
            team_user_ids_with_strings.append(uid)
            if isinstance(uid, ObjectId):
                team_user_ids_with_strings.append(str(uid))
            elif isinstance(uid, str) and ObjectId.is_valid(uid):
                team_user_ids_with_strings.append(ObjectId(uid))

        query = {
            "user_id": {"$in": team_user_ids_with_strings},
            "is_deleted": {"$ne": True},
        }

        entries = await self.find_many(
            query,
            skip=skip,
            limit=limit,
            sort=[("entry_data.date_pointage", -1), ("created_at", -1)],
        )

        return entries

    async def find_by_lc_column_value(self, column_name: str, value: str, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """Find entries by selected value from a specific LC field (clef_imputation, libelle, or fonction)"""
        field_key = f"entry_data.{column_name}"
        return await self.find_many(
            {
                field_key: value,
                "is_deleted": False,
            },
            skip=skip,
            limit=limit,
            sort=[("created_at", -1)],
        )

    async def find_by_week(self, user_id: ObjectId, week: str, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """Find entries by week for a user"""
        return await self.find_many(
            {
                "user_id": user_id,
                "entry_data.week": week,
                "is_deleted": False,
            },
            skip=skip,
            limit=limit,
        )


class ModificationRequestRepository(BaseRepository):
    """
    Repository for modification_requests collection
    """
    def __init__(self):
        super().__init__("modification_requests")

    async def create(self, modification_request: ModificationRequest) -> ObjectId:
        """Create a new modification request"""
        doc = modification_request.model_dump(by_alias=True, exclude={"id"})
        doc["_id"] = ObjectId()
        doc["created_at"] = datetime.utcnow()

        if "entry_id" in doc:
            if isinstance(doc["entry_id"], str) and ObjectId.is_valid(doc["entry_id"]):
                doc["entry_id"] = ObjectId(doc["entry_id"])
        if "user_id" in doc:
            if isinstance(doc["user_id"], str) and ObjectId.is_valid(doc["user_id"]):
                doc["user_id"] = ObjectId(doc["user_id"])

        result = await self.collection.insert_one(doc)
        return result.inserted_id

    async def find_by_team(self, responsible_id: ObjectId, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """Find modification requests for a responsible's team members"""
        user_repo = UserRepository()
        team_members = await user_repo.find_by_responsible(responsible_id)
        team_user_ids = [member["_id"] for member in team_members]
        if not team_user_ids:
            return []

        team_user_ids_with_strings = []
        for uid in team_user_ids:
            team_user_ids_with_strings.append(uid)
            if isinstance(uid, ObjectId):
                team_user_ids_with_strings.append(str(uid))
            elif isinstance(uid, str) and ObjectId.is_valid(uid):
                team_user_ids_with_strings.append(ObjectId(uid))

        query = {
            "user_id": {"$in": team_user_ids_with_strings},
            "is_deleted": {"$ne": True},
        }

        return await self.find_many(
            query,
            skip=skip,
            limit=limit,
            sort=[("created_at", -1)],
        )

    async def find_by_user(self, user_id: ObjectId, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """Find modification requests for a specific user"""
        user_id_str = str(user_id) if isinstance(user_id, ObjectId) else user_id
        query = {
            "user_id": {"$in": [user_id, user_id_str]},
            "is_deleted": {"$ne": True},
        }

        return await self.find_many(
            query,
            skip=skip,
            limit=limit,
            sort=[("created_at", -1)],
        )


class AuditLogRepository(BaseRepository):
    """Repository for audit_logs collection"""
    def __init__(self):
        super().__init__("audit_logs")

    async def create(self, audit_log: AuditLog) -> ObjectId:
        """Create a new audit log entry"""
        doc = audit_log.model_dump(by_alias=True, exclude={"id"})
        doc["_id"] = ObjectId()
        doc["timestamp"] = datetime.utcnow()
        result = await self.collection.insert_one(doc)
        return result.inserted_id

    async def find_by_resource(self, resource_type: str, resource_id: ObjectId, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """Find audit logs by resource"""
        return await self.find_many(
            {"resource_type": resource_type, "resource_id": resource_id},
            skip=skip,
            limit=limit,
            sort=[("timestamp", -1)],
        )

    async def find_by_user(self, user_id: str, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """Find audit logs by user"""
        return await self.find_many(
            {"user_id": user_id},
            skip=skip,
            limit=limit,
            sort=[("timestamp", -1)],
        )

    async def find_by_event_type(self, event_type: str, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """Find audit logs by event type"""
        return await self.find_many(
            {"event_type": event_type},
            skip=skip,
            limit=limit,
            sort=[("timestamp", -1)],
        )


class BackgroundJobRepository(BaseRepository):
    """
    Repository for background_jobs collection

    Background jobs are asynchronous operations triggered from the frontend:
    - export_pointage: View pointage collection as table (read-only for Responsible/Admin)
    - lc_update: Update LC collection (add/remove/activate/deactivate items)
    - import_data: Bulk import from Excel (LC data or Users)
    - cleanup: Permanent deletion of deleted/archived data (Admin only)
    """
    def __init__(self):
        super().__init__("background_jobs")

    async def create(self, background_job: BackgroundJob) -> ObjectId:
        """Create a new background job"""
        doc = background_job.model_dump(by_alias=True, exclude={"id"})
        doc["_id"] = ObjectId()
        doc["created_at"] = datetime.utcnow()
        result = await self.collection.insert_one(doc)
        return result.inserted_id

    async def update_status(
        self,
        document_id: ObjectId,
        status: str,
        started_at: Optional[datetime] = None,
        completed_at: Optional[datetime] = None,
        duration_ms: Optional[float] = None) -> bool:
        """Update job status"""
        update_dict = {"status": status}
        if started_at:
            update_dict["started_at"] = started_at

        if completed_at:
            update_dict["completed_at"] = completed_at

        if duration_ms is not None:
            update_dict["duration_ms"] = duration_ms

        result = await self.collection.update_one(
            {"_id": document_id}, {"$set": update_dict}
        )
        return result.modified_count > 0

    async def update_progress(
        self,
        document_id: ObjectId,
        current: int,
        total: int,
        message: Optional[str] = None) -> bool:
        """Update job progress"""
        percentage = (current / total * 100) if total > 0 else 0
        update_dict = {
            "progress.current": current,
            "progress.total": total,
            "progress.percentage": percentage,
        }
        if message:
            update_dict["progress.message"] = message

        result = await self.collection.update_one(
            {"_id": document_id}, {"$set": update_dict}
        )
        return result.modified_count > 0

    async def set_error(
        self,
        document_id: ObjectId,
        error_message: str,
        stack_trace: Optional[str] = None,
        error_code: Optional[str] = None) -> bool:
        """Set job error"""
        error_dict = {"message": error_message}
        if stack_trace:
            error_dict["stack_trace"] = stack_trace

        if error_code:
            error_dict["error_code"] = error_code

        result = await self.collection.update_one(
            {"_id": document_id},
            {"$set": {"error": error_dict, "status": "failed"}},
        )
        return result.modified_count > 0

    async def find_pending(self, job_type: Optional[str] = None, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """Find pending jobs"""
        filter_dict = {"status": "pending"}
        if job_type:
            filter_dict["job_type"] = job_type

        return await self.find_many(
            filter_dict,
            skip=skip,
            limit=limit,
            sort=[("created_at", 1)],
        )

    async def find_by_status(self, status: str, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """Find jobs by status"""
        return await self.find_many(
            {"status": status},
            skip=skip,
            limit=limit,
            sort=[("created_at", -1)],
        )

    async def find_by_type(self, job_type: str, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """Find jobs by type"""
        return await self.find_many(
            {"job_type": job_type},
            skip=skip,
            limit=limit,
            sort=[("created_at", -1)],
        )
