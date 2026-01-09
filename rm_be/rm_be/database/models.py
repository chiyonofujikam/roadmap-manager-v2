"""Pydantic models for database collections - Simplified Schema"""

from datetime import date, datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId
from pydantic import BaseModel, EmailStr, Field, GetJsonSchemaHandler
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import core_schema


def _objectid_validator(value: Any) -> ObjectId:
    """Validator for ObjectId"""
    if isinstance(value, ObjectId):
        return value

    if isinstance(value, str):
        if ObjectId.is_valid(value):
            return ObjectId(value)

        raise ValueError("Invalid ObjectId string")

    raise ValueError("ObjectId must be a string or ObjectId instance")

def _objectid_serializer(value: ObjectId) -> str:
    """Serializer for ObjectId"""
    return str(value)

class PyObjectId:
    """Pydantic v2 compatible ObjectId type annotation"""

    @classmethod
    def __get_pydantic_core_schema__(cls, source_type: Any, handler: Any) -> core_schema.CoreSchema:
        return core_schema.no_info_plain_validator_function(
            _objectid_validator,
            serialization=core_schema.plain_serializer_function_ser_schema(
                _objectid_serializer,
                return_schema=core_schema.str_schema()
            ),
        )

    @classmethod
    def __get_pydantic_json_schema__(
        cls, _core_schema: core_schema.CoreSchema,
        handler: GetJsonSchemaHandler) -> JsonSchemaValue:
        return {"type": "string", "format": "objectid"}

class UserMetadata(BaseModel):
    """User metadata"""
    department: Optional[str] = None
    manager: Optional[str] = None
    location: Optional[str] = None
    hire_date: Optional[datetime] = None
    custom_fields: Dict[str, Any] = Field(default_factory=dict)

class User(BaseModel):
    """User document model - Simplified with team relationships"""
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    name: str = Field(..., min_length=1, max_length=200)
    email: Optional[EmailStr] = None
    user_type: str = Field(..., pattern="^(collaborator|responsible|admin)$")
    responsible_id: Optional[PyObjectId] = None
    status: str = Field(default="active", pattern="^(active|inactive)$")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str
    updated_by: str
    metadata: UserMetadata = Field(default_factory=UserMetadata)
    is_deleted: bool = Field(default=False)
    is_archived: bool = Field(default=False)

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
    }

class ConditionalListItem(BaseModel):
    """
    Conditional list item - LC (Liste Conditionnelle) with 3 fields

    Each LC item has 3 main fields that can be managed independently:
    - clef_imputation: Can be independently activated/deactivated
    - libelle: Can be independently activated/deactivated
    - fonction: Can be independently activated/deactivated

    These fields provide dropdown options in the pointage filling interface.
    Responsible users can activate/deactivate individual fields or entire items.
    """
    clef_imputation: str = Field(..., min_length=1, description="Clef d'imputation")
    libelle: str = Field(..., min_length=1, description="Libellé")
    fonction: str = Field(..., description="Fonction")
    is_active: bool = Field(default=True, description="Active status - managed by responsible/admin")

class ConditionalList(BaseModel):
    """
    Conditional list document model - Simplified

    LC (Liste Conditionnelle) is a reference list with 3 main fields that provide
    dropdown options for pointage entries. Admin and Responsible users can:
    - Add new LC items
    - Remove LC items
    - Activate/deactivate LC items (each field can be managed independently)
    - Update LC item values

    LC items are used in the pointage filling interface where collaborators select
    values from these fields when creating pointage entries.

    Each LC item field can be independently activated/deactivated by Responsible users.
    """
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    name: str = Field(..., min_length=1, max_length=200, description="LC name/identifier")
    description: Optional[str] = None
    items: List[ConditionalListItem] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str
    updated_by: str
    is_deleted: bool = Field(default=False)
    is_archived: bool = Field(default=False)

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
    }

class PointageEntryData(BaseModel):
    """Pointage entry data - filled by collaborators from LC fields"""
    date_pointage: date = Field(..., description="Date of the pointage record - filled by user")
    cstr_semaine: Optional[str] = Field(None, description="Associated week of date_pointage - auto-calculated from date_pointage")
    clef_imputation: Optional[str] = Field(None, description="Clef d'imputation - selected value from LC clef_imputation field")
    libelle: Optional[str] = Field(None, description="Libellé - selected value from LC libelle field")
    fonction: Optional[str] = Field(None, description="Fonction - selected value from LC fonction field")
    date_besoin: Optional[date] = Field(None, description="Date du besoin - filled by user")
    heures_theoriques: Optional[str] = Field(None, description="Nbre d'heures théoriques - filled by user")
    heures_passees: Optional[str] = Field(None, description="Heures passées - filled by user")
    commentaires: Optional[str] = Field(None, description="Commentaires - filled by user")

class PointageEntry(BaseModel):
    """
    Pointage entry document model - Simplified, filled by collaborators

    Each collaborator (user_type='collaborator') has a dedicated frontend page
    for filling their daily pointage data. The frontend displays a weekly calendar
    view where users can:
    - Fill pointage entries for each day of the week
    - Select values from Conditional List (LC) fields (clef_imputation, libelle, fonction)
    - Enter date_besoin, heures_theoriques, heures_passees, and commentaires
    - Save entries as draft
    - Submit entries for validation (locks the entry)

    Workflow:
    1. User selects a week in the calendar view
    2. User selects a day and fills the form
    3. User saves entry (status='draft') - can still edit
    4. User submits entry (status='submitted') - locked, cannot edit
    5. Responsible validates entry (status='validated') or rejects it (status='rejected')
    """
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    user_id: PyObjectId = Field(..., description="Collaborator who created this entry")
    entry_data: PointageEntryData
    status: str = Field(default="draft", pattern="^(draft|submitted|validated|rejected)$")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    submitted_at: Optional[datetime] = None
    validated_at: Optional[datetime] = None
    validated_by: Optional[str] = None
    is_deleted: bool = Field(default=False)
    is_archived: bool = Field(default=False)

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
    }

class ChangeTracking(BaseModel):
    """Change tracking data"""
    before: Optional[Dict[str, Any]] = None
    after: Optional[Dict[str, Any]] = None
    diff: Optional[Dict[str, Any]] = None

class AuditLogMetadata(BaseModel):
    """Audit log metadata"""
    duration_ms: Optional[float] = None
    affected_count: Optional[int] = None
    error_message: Optional[str] = None
    stack_trace: Optional[str] = None

class AuditLog(BaseModel):
    """Audit log document model"""
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    event_type: str = Field(...,pattern="^(create|update|delete|export|import|archive|restore|validate|reject)$",)
    resource_type: str
    resource_id: PyObjectId
    user_id: str
    user_email: Optional[str] = None
    user_ip: Optional[str] = None
    user_agent: Optional[str] = None
    action: str
    status: str = Field(..., pattern="^(success|failure|partial)$")
    changes: ChangeTracking = Field(default_factory=ChangeTracking)
    request_id: Optional[str] = None
    session_id: Optional[str] = None
    correlation_id: Optional[str] = None
    metadata: AuditLogMetadata = Field(default_factory=AuditLogMetadata)
    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
    }

class JobProgress(BaseModel):
    """Job progress tracking"""
    current: int = 0
    total: int = 0
    percentage: float = Field(default=0.0, ge=0, le=100)
    message: Optional[str] = None

class JobError(BaseModel):
    """Job error information"""
    message: Optional[str] = None
    stack_trace: Optional[str] = None
    error_code: Optional[str] = None

class RelatedResource(BaseModel):
    """Related resource reference"""
    resource_type: str
    resource_id: PyObjectId

class BackgroundJob(BaseModel):
    """
    Background job document model

    Background jobs are asynchronous operations triggered from the frontend that perform
    database operations (read, modify, delete, archive). These jobs handle long-running
    operations that should not block API requests.

    Job Types:
    - lc_update: Admin/Responsible updates Conditional List (LC) collection
      * Add/remove LC items
      * Activate/deactivate LC items (each field can be managed independently)
      * Modifies conditional_lists collection

    - export_pointage: Responsible/Admin views entire pointage collection as table
      * Reads pointage_entries collection
      * Generates table view/export for Responsible or Admin users
      * Does not modify data, only reads and formats for display

    - import_data: Bulk import from Excel files
      * Import LC data from Excel (fills conditional_lists collection)
      * Import Users from Excel (fills users collection)
      * Processes Excel files and bulk inserts data

    - cleanup: Admin permanently removes deleted/archived data
      * Removes old LC data (is_deleted=True)
      * Removes inactive users
      * Removes old pointage data
      * Hard deletes archived records
    """
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    job_type: str = Field(
        ...,
        pattern="^(lc_update|export_pointage|import_data|cleanup)$",
        description="Type of background job: lc_update, export_pointage, import_data, or cleanup"
    )
    job_name: str
    status: str = Field(
        ...,
        pattern="^(pending|running|completed|failed|cancelled)$",
    )
    progress: JobProgress = Field(default_factory=JobProgress)
    parameters: Dict[str, Any] = Field(default_factory=dict)
    result: Optional[Dict[str, Any]] = None
    error: Optional[JobError] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_ms: Optional[float] = None
    scheduled_for: Optional[datetime] = None
    retry_count: int = 0
    max_retries: int = 3
    created_by: str
    related_resources: List[RelatedResource] = Field(default_factory=list)

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
    }
