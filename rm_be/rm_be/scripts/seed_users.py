"""Seed script to populate users from mockusers.json"""

import asyncio
import json
from pathlib import Path

from rm_be.database import User, UserRepository, close_database, init_database


async def seed_users():
    """Seed users from mockusers.json into the database"""
    try:
        print("Connecting to MongoDB...")
        await init_database()
        mock_file = Path(__file__).parent.parent.parent / "mockusers.json"
        if not mock_file.exists():
            print(f"[ERROR] mockusers.json not found at {mock_file}")
            return

        with open(mock_file, 'r', encoding='utf-8') as f:
            mock_data = json.load(f)

        users_data = mock_data.get("users", {})
        if not users_data:
            print("[ERROR] No users found in mockusers.json")
            return

        repo = UserRepository()
        admin_responsible_ids = {}
        for email, user_data in users_data.items():
            user_type = user_data.get("user_type", "")
            if user_type == "collaborator":
                continue

            existing = await repo.find_by_email(email)
            if existing:
                print(f"[!] User {email} already exists, updating if needed...")
                admin_responsible_ids[user_data.get("id")] = existing["_id"]
                update_data = {
                    "name": user_data.get("name", ""),
                    "user_type": user_type,
                    "updated_by": "system"
                }
                await repo.update(existing["_id"], User(**{**existing, **update_data}), "system")
                continue

            user = User(
                name=user_data.get("name", ""),
                email=email,
                user_type=user_type,
                status="active",
                created_by="system",
                updated_by="system"
            )
            user_id = await repo.create(user)
            admin_responsible_ids[user_data.get("id")] = user_id
            print(f"[OK] Created {user_type}: {email} (ID: {user_id})")

        for email, user_data in users_data.items():
            user_type = user_data.get("user_type", "")
            if user_type != "collaborator":
                continue

            existing = await repo.find_by_email(email)
            responsible_mock_id = user_data.get("responsible_id")
            responsible_object_id = None
            if responsible_mock_id and responsible_mock_id in admin_responsible_ids:
                responsible_object_id = admin_responsible_ids[responsible_mock_id]

            if existing:
                current_responsible_id = existing.get("responsible_id")
                if current_responsible_id != responsible_object_id:
                    print(f"[!] User {email} already exists, updating responsible_id...")
                    update_data = {
                        **existing,
                        "name": user_data.get("name", existing.get("name", "")),
                        "responsible_id": responsible_object_id,
                        "updated_by": "system"
                    }
                    await repo.update(existing["_id"], User(**update_data), "system")
                    print(f"[OK] Updated collaborator: {email} with responsible_id: {responsible_object_id}")
                else:
                    print(f"[!] User {email} already exists with correct responsible_id, skipping...")
                continue

            user = User(
                name=user_data.get("name", ""),
                email=email,
                user_type=user_type,
                responsible_id=responsible_object_id,
                status="active",
                created_by="system",
                updated_by="system"
            )
            user_id = await repo.create(user)
            print(f"[OK] Created collaborator: {email} (ID: {user_id}) with responsible_id: {responsible_object_id}")
        print(f"\n[OK] Successfully seeded {len(users_data)} users!")

    except Exception as e:
        raise Exception(f"[ERROR] Error seeding users: {e}")

    finally:
        await close_database()

if __name__ == "__main__":
    asyncio.run(seed_users())
