"""API request/response schemas (Pydantic models)"""

from typing import Optional

from pydantic import BaseModel


class PointageEntryCreate(BaseModel):
    """Schema for creating a new pointage entry"""
    date_pointage: str
    clef_imputation: str
    libelle: str
    fonction: str
    date_besoin: str
    heures_theoriques: str
    heures_passees: str
    commentaires: Optional[str] = None


class PointageEntryUpdate(BaseModel):
    """Schema for updating an existing pointage entry"""
    clef_imputation: str
    libelle: str
    fonction: str
    date_besoin: str
    heures_theoriques: str
    heures_passees: str
    commentaires: Optional[str] = None


class ModificationRequestCreate(BaseModel):
    """Schema for creating a modification request"""
    entry_id: str
    requested_data: PointageEntryUpdate
    comment: Optional[str] = None


class ModificationRequestReview(BaseModel):
    """Schema for reviewing a modification request"""
    status: str
    review_comment: Optional[str] = None


class LCItemUpdate(BaseModel):
    """Schema for updating a single LC item cell"""
    item_index: int
    field: str
    value: str
    is_active: Optional[bool] = None


class UserCreate(BaseModel):
    """Schema for creating a new user"""
    name: str
    email: Optional[str] = None
    user_type: str
    status: str = "active"
    responsible_id: Optional[str] = None


class UserUpdate(BaseModel):
    """Schema for updating an existing user"""
    name: Optional[str] = None
    email: Optional[str] = None
    user_type: Optional[str] = None
    status: Optional[str] = None
    responsible_id: Optional[str] = None


class ActiveLCUpdate(BaseModel):
    """Schema for setting the active conditional list"""
    lc_name: str


class LCItemCreate(BaseModel):
    """Schema for creating a new LC item"""
    clef_imputation: str
    libelle: str
    fonction: str
    is_active: bool = True


class ConditionalListCreate(BaseModel):
    """Schema for creating a new conditional list"""
    name: str
    description: Optional[str] = None
    items: list[LCItemCreate]


class LCMergeRequest(BaseModel):
    """Schema for merging items into an existing LC"""
    lc_name: str
    items: list[LCItemCreate]
    remove_duplicates: bool = True