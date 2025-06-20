#!/usr/bin/env python3
"""
Database migration script to add description column to binaries table.
"""

import asyncio
import sys
import os

# Add the parent directory to the path so we can import from app
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import AsyncSessionLocal


async def migrate_add_binary_description():
    """Add description column to binaries table."""
    async with AsyncSessionLocal() as db:
        try:
            # Check if description column already exists
            result = await db.execute("PRAGMA table_info(binaries)")
            columns = [row[1] for row in result.fetchall()]

            if "description" in columns:
                print("✅ Description column already exists in binaries table")
                return True

            print("Adding description column to binaries table...")

            # Add the description column
            await db.execute("ALTER TABLE binaries ADD COLUMN description TEXT")
            await db.commit()

            print("✅ Successfully added description column to binaries table")
            return True

        except Exception as e:
            print(f"❌ Error adding description column: {e}")
            await db.rollback()
            return False


def main():
    print("Running migration to add description column to binaries table...")
    success = asyncio.run(migrate_add_binary_description())

    if success:
        print("\n🎉 Migration completed successfully!")
        print(
            "You can now run populate_binaries.py to add descriptions to your binaries."
        )
    else:
        print("\n❌ Migration failed!")
        sys.exit(1)


if __name__ == "__main__":
    main()
