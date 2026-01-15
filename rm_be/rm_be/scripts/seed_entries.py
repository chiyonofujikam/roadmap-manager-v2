"""Seed script to populate pointage entries from mock_entries.json"""

import asyncio
import json
from datetime import datetime, timedelta
from pathlib import Path

from rm_be.api.utils import get_cstr_semaine
from rm_be.database import (PointageEntry, PointageEntryData,
                            PointageEntryRepository, UserRepository,
                            close_database, init_database)


async def seed_entries():
    """Seed pointage entries from mock_entries.json into the database"""
    try:
        print("Connecting to MongoDB...")
        await init_database()

        mock_file = Path(__file__).parent.parent.parent / "mock_entries.json"
        if not mock_file.exists():
            print(f"[ERROR] mock_entries.json not found at {mock_file}")
            return

        with open(mock_file, 'r', encoding='utf-8') as f:
            mock_data = json.load(f)

        entries_data = mock_data.get("entries", [])
        if not entries_data:
            print("[ERROR] No entries found in mock_entries.json")
            return

        created_count = 0
        skipped_count = 0
        user_repo = UserRepository()
        pointage_repo = PointageEntryRepository()
        for entry_data in entries_data:
            user_email = entry_data.get("user_email")
            if not user_email:
                print("[WARNING] Entry missing user_email, skipping...")
                skipped_count += 1
                continue

            user = await user_repo.find_by_email(user_email)
            if not user:
                print(f"[WARNING] User {user_email} not found, skipping entry...")
                skipped_count += 1
                continue

            if user.get("user_type") != "collaborator":
                print(f"[WARNING] User {user_email} is not a collaborator, skipping entry...")
                skipped_count += 1
                continue

            user_id = user.get("_id")
            entry_info = entry_data.get("entry_data", {})
            try:
                date_pointage = datetime.strptime(entry_info.get("date_pointage"), "%Y-%m-%d").date()
                date_besoin = datetime.strptime(entry_info.get("date_besoin"), "%Y-%m-%d").date()
            except (ValueError, TypeError) as e:
                print(f"[WARNING] Invalid date format in entry for {user_email}: {e}")
                skipped_count += 1
                continue

            week_start = date_pointage - timedelta(days=date_pointage.weekday())
            cstr_semaine = get_cstr_semaine(week_start)
            pointage_entry_data = PointageEntryData(
                date_pointage=date_pointage,
                cstr_semaine=cstr_semaine,
                clef_imputation=entry_info.get("clef_imputation", ""),
                libelle=entry_info.get("libelle", ""),
                fonction=entry_info.get("fonction", ""),
                date_besoin=date_besoin,
                heures_theoriques=entry_info.get("heures_theoriques", ""),
                heures_passees=entry_info.get("heures_passees", ""),
                commentaires=entry_info.get("commentaires"),
            )

            pointage_entry = PointageEntry(
                user_id=user_id,
                entry_data=pointage_entry_data,
                status="draft"
            )

            entry_id = await pointage_repo.create(pointage_entry)
            created_count += 1
            print(f"[OK] Created entry for {user_email} on {date_pointage} (ID: {entry_id})")

        print(f"\n[OK] Successfully seeded {created_count} pointage entries!")
        if skipped_count > 0:
            print(f"[INFO] Skipped {skipped_count} entries")

    except Exception as e:
        raise Exception(f"[ERROR] Error seeding entries: {e}")

    finally:
        await close_database()


if __name__ == "__main__":
    asyncio.run(seed_entries())
