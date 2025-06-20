#!/usr/bin/env python3
"""
Database initialization script for CPython Memory Tracker.
This script creates all necessary tables in the SQLite database.
"""

import asyncio
import sys
import os

# Add the parent directory to the path so we can import from app
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import create_tables, drop_tables


async def init_database():
    """Initialize the database by creating all tables."""
    print("Initializing database...")

    try:
        await create_tables()
        print("✅ Database tables created successfully!")
    except Exception as e:
        print(f"❌ Error creating database tables: {e}")
        return False

    return True


async def reset_database():
    """Reset the database by dropping and recreating all tables."""
    print("Resetting database...")

    try:
        await drop_tables()
        print("🗑️  Existing tables dropped")

        await create_tables()
        print("✅ Database tables recreated successfully!")
    except Exception as e:
        print(f"❌ Error resetting database: {e}")
        return False

    return True


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Initialize or reset the database")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Reset the database (drop and recreate tables)",
    )

    args = parser.parse_args()

    if args.reset:
        success = asyncio.run(reset_database())
    else:
        success = asyncio.run(init_database())

    if not success:
        sys.exit(1)
