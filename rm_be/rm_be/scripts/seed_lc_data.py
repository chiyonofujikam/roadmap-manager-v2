"""Seed script to populate LC (Conditional List) data from mock table"""

import asyncio

from rm_be.database import (ConditionalList, ConditionalListItem,
                            ConditionalListRepository, close_database,
                            init_database)

LC_ITEMS = [
    {"clef_imputation": "Congés", "libelle": "Réunion interne", "fonction": "AIR"},
    {"clef_imputation": "Réunions", "libelle": "Réunions Projet (pôle, CR, ...)", "fonction": "ATP"},
    {"clef_imputation": "STR5.2.pré-MESC Sprint 3", "libelle": "Event list", "fonction": "BOG"},
    {"clef_imputation": "STR5.2.pré-MESC Sprint 4", "libelle": "Support maintenance", "fonction": "BRK"},
    {"clef_imputation": "STR5.2.MESC Sprint 1", "libelle": "ADL1", "fonction": "CAT"},
    {"clef_imputation": "STR5.2.MESC Sprint 2", "libelle": "SwDS", "fonction": "CLM"},
    {"clef_imputation": "STR7.1.2", "libelle": "UVR ADL1", "fonction": "CPL"},
    {"clef_imputation": "STR7.1.3 Sprint 3", "libelle": "UVR SwDS", "fonction": "DGN"},
    {"clef_imputation": "STR7.1.3 Sprint 4", "libelle": "SwDS (ICD)", "fonction": "DRS"},
    {"clef_imputation": "STR7.1.4", "libelle": "Dossiers Safety", "fonction": "DRV"},
    {"clef_imputation": "STR7.1.5", "libelle": "FPS + revue", "fonction": "ESG"},
    {"clef_imputation": "STR9.1 Sprint 1", "libelle": "OCD", "fonction": "FSD"},
    {"clef_imputation": "STR9.1 Sprint 2", "libelle": "DR", "fonction": "HVS"},
    {"clef_imputation": "STR9.1 Sprint 3", "libelle": "Croissance de fiab", "fonction": "IDR"},
]


async def seed_lc_data():
    """Seed LC data into the database"""
    try:
        print("Connecting to MongoDB...")
        await init_database()

        repo = ConditionalListRepository()
        existing_lc = await repo.find_by_name("Default LC")
        if existing_lc:
            print(f"LC 'Default LC' already exists with {len(existing_lc.get('items', []))} items.")
            print("Skipping seed. Delete the existing LC if you want to re-seed.")
            return

        items = [
            ConditionalListItem(
                clef_imputation=item["clef_imputation"],
                libelle=item["libelle"],
                fonction=item["fonction"],
                is_active=True
            )
            for item in LC_ITEMS
        ]
        
        conditional_list = ConditionalList(
            name="Default LC",
            description="Default conditional list with mock data from LC table",
            items=items,
            created_by="system",
            updated_by="system"
        )

        lc_id = await repo.create(conditional_list)
        print(f"✅ Successfully seeded LC data!")
        print(f"   Created LC: 'Default LC' (ID: {lc_id})")
        print(f"   Added {len(items)} items")
        print("\nItems added:")
        for i, item in enumerate(LC_ITEMS, 1):
            print(f"   {i}. {item['clef_imputation']} | {item['libelle']} | {item['fonction']}")

    except Exception as e:
        raise Exception(f"❌ Error seeding LC data: {e}")

    finally:
        await close_database()


if __name__ == "__main__":
    asyncio.run(seed_lc_data())
