"""Database module - Simplified Schema"""

from .connection import close_database, get_database, init_database
from .indexes import create_indexes
from .models import (AuditLog, BackgroundJob, ConditionalList,
                     ConditionalListItem, ModificationRequest, PointageEntry,
                     PointageEntryData, User, UserMetadata)
from .repositories import (AuditLogRepository, BackgroundJobRepository,
                           ConditionalListRepository,
                           ModificationRequestRepository,
                           PointageEntryRepository, UserRepository)

__all__ = [
    "get_database",
    "init_database",
    "close_database",
    "create_indexes",
    "User",
    "UserMetadata",
    "ConditionalList",
    "ConditionalListItem",
    "ModificationRequest",
    "PointageEntry",
    "PointageEntryData",
    "AuditLog",
    "BackgroundJob",
    "UserRepository",
    "ConditionalListRepository",
    "ModificationRequestRepository",
    "PointageEntryRepository",
    "AuditLogRepository",
    "BackgroundJobRepository",
]
