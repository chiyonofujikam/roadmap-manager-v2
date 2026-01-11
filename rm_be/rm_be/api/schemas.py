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
