"""Database initialization script"""

import asyncio

from rm_be.database import (close_database, create_indexes, get_database,
                            init_database)


async def initialize_database():
    """Initialize database and create indexes"""
    try:
        print("Connecting to MongoDB...")
        await init_database()

        print("Creating indexes...")
        db = get_database()
        await create_indexes(db)

        print("Database initialized successfully!")
        collections = await db.list_collection_names()
        print(f"\nCollections: {', '.join(collections) if collections else 'None'}")

    except Exception as e:
        print(f"Error initializing database: {e}")
        raise

    finally:
        await close_database()


if __name__ == "__main__":
    asyncio.run(initialize_database())
