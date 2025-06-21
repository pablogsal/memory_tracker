#!/usr/bin/env python3
"""
Migration script to add display fields (color, icon, display_order) to binaries table.
"""

import asyncio
import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_session_local
from app.config import get_settings

logger = logging.getLogger(__name__)

async def migrate_binary_display_fields():
    """Add color, icon, and display_order columns to binaries table."""
    settings = get_settings()
    async_session_local = get_async_session_local()
    
    async with async_session_local() as db:
        try:
            # Check if columns already exist
            check_query = text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'binaries' 
                AND column_name IN ('color', 'icon', 'display_order')
            """)
            
            # For SQLite, use a different approach
            if 'sqlite' in settings.database_url.lower():
                check_query = text("PRAGMA table_info(binaries)")
            
            result = await db.execute(check_query)
            existing_columns = set()
            
            if 'sqlite' in settings.database_url.lower():
                # SQLite returns different format
                for row in result:
                    existing_columns.add(row[1])  # column name is at index 1
            else:
                # PostgreSQL/MySQL format
                for row in result:
                    existing_columns.add(row[0])
            
            logger.info(f"Existing columns: {existing_columns}")
            
            # Add missing columns
            migrations = []
            if 'color' not in existing_columns:
                migrations.append("ALTER TABLE binaries ADD COLUMN color VARCHAR(7) DEFAULT '#8b5cf6'")
            
            if 'icon' not in existing_columns:
                migrations.append("ALTER TABLE binaries ADD COLUMN icon VARCHAR(50) DEFAULT 'server'")
            
            if 'display_order' not in existing_columns:
                migrations.append("ALTER TABLE binaries ADD COLUMN display_order INTEGER DEFAULT 0")
            
            if not migrations:
                logger.info("All columns already exist, no migration needed")
                return
            
            # Execute migrations
            for migration in migrations:
                logger.info(f"Executing: {migration}")
                await db.execute(text(migration))
            
            await db.commit()
            logger.info("Successfully added display fields to binaries table")
            
        except Exception as e:
            logger.error(f"Migration failed: {e}")
            await db.rollback()
            raise

async def main():
    """Main migration function."""
    logging.basicConfig(level=logging.INFO)
    logger.info("Starting binary display fields migration...")
    
    try:
        await migrate_binary_display_fields()
        logger.info("Migration completed successfully!")
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main())