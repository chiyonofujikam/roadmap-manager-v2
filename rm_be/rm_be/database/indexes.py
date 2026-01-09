"""Database index creation - Simplified Schema"""

from motor.motor_asyncio import AsyncIOMotorDatabase


async def create_indexes(db: AsyncIOMotorDatabase) -> None:
    """Create all database indexes for simplified schema"""
    users = db["users"]
    await users.create_index(
        [("name", 1)],
        unique=True,
        collation={"locale": "en", "strength": 2},
    )
    await users.create_index(
        [("email", 1)],
        unique=True,
        sparse=True,
        collation={"locale": "en", "strength": 2},
    )
    await users.create_index([("user_type", 1), ("status", 1), ("is_deleted", 1)])
    await users.create_index([("responsible_id", 1), ("status", 1)])
    await users.create_index([("is_deleted", 1), ("is_archived", 1)])
    await users.create_index([("metadata.department", 1), ("status", 1)])

    conditional_lists = db["conditional_lists"]
    await conditional_lists.create_index([("name", 1)], unique=True)
    await conditional_lists.create_index([("is_deleted", 1), ("is_archived", 1)])
    await conditional_lists.create_index([("items.clef_imputation", 1)])
    await conditional_lists.create_index([("items.is_active", 1)])

    pointage_entries = db["pointage_entries"]
    await pointage_entries.create_index(
        [
            ("user_id", 1),
            ("created_at", -1),
        ]
    )
    await pointage_entries.create_index([("entry_data.clef_imputation", 1)])
    await pointage_entries.create_index([("entry_data.libelle", 1)])
    await pointage_entries.create_index([("entry_data.fonction", 1)])
    await pointage_entries.create_index([("status", 1), ("is_deleted", 1)])
    await pointage_entries.create_index([("is_deleted", 1), ("is_archived", 1)])
    await pointage_entries.create_index([("created_at", -1)])
    await pointage_entries.create_index([("user_id", 1), ("status", 1), ("is_deleted", 1)])

    audit_logs = db["audit_logs"]
    await audit_logs.create_index(
        [("timestamp", -1)],
        expireAfterSeconds=63072000,
    )
    await audit_logs.create_index(
        [
            ("resource_type", 1),
            ("resource_id", 1),
            ("timestamp", -1),
        ]
    )
    await audit_logs.create_index([("user_id", 1), ("timestamp", -1)])
    await audit_logs.create_index([("event_type", 1), ("timestamp", -1)])
    await audit_logs.create_index([("request_id", 1)])
    await audit_logs.create_index([("status", 1), ("timestamp", -1)])

    background_jobs = db["background_jobs"]
    await background_jobs.create_index([("status", 1), ("created_at", -1)])
    await background_jobs.create_index([("job_type", 1), ("status", 1)])
    await background_jobs.create_index([("created_by", 1), ("created_at", -1)])
    await background_jobs.create_index([("scheduled_for", 1)])


async def create_validation_schemas(db: AsyncIOMotorDatabase) -> None:
    """Create MongoDB JSON schema validators for collections"""
    pass
