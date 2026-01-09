"""API request/response schemas (Pydantic models)"""

from typing import Optional

from pydantic import BaseModel


class PointageEntryCreate(BaseModel):
    """Schema for creating a new pointage entry"""
    date_pointage: str
    clef_imputation: Optional[str] = None
    libelle: Optional[str] = None
    fonction: Optional[str] = None
    date_besoin: Optional[str] = None
    heures_theoriques: Optional[str] = None
    heures_passees: Optional[str] = None
    commentaires: Optional[str] = None


class PointageEntryUpdate(BaseModel):
    """Schema for updating an existing pointage entry"""
    clef_imputation: Optional[str] = None
    libelle: Optional[str] = None
    fonction: Optional[str] = None
    date_besoin: Optional[str] = None
    heures_theoriques: Optional[str] = None
    heures_passees: Optional[str] = None
    commentaires: Optional[str] = None
