"""MongoDB connection management"""

from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from rm_be.config import settings

_client: Optional[AsyncIOMotorClient] = None
_database: Optional[AsyncIOMotorDatabase] = None


async def init_database() -> None:
    """Initialize MongoDB connection"""
    global _client, _database

    if _client is None:
        _client = AsyncIOMotorClient(
            settings.mongodb_uri,
            serverSelectionTimeoutMS=5000,
        )
        _database = _client[settings.mongodb_db_name]

        try:
            await _client.admin.command("ping")
        except Exception as e:
            raise ConnectionError(f"Failed to connect to MongoDB: {e}") from e

async def close_database() -> None:
    """Close MongoDB connection"""
    global _client
    if _client is not None:
        _client.close()
        _client = None

def get_database() -> AsyncIOMotorDatabase:
    """Get database instance"""
    if _database is None:
        raise RuntimeError("Database not initialized. Call init_database() first.")
    return _database

def get_client() -> AsyncIOMotorClient:
    """Get MongoDB client instance"""
    if _client is None:
        raise RuntimeError("Database not initialized. Call init_database() first.")
    return _client
