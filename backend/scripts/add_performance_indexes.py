#!/usr/bin/env python3
"""
Script to add performance indexes to an existing database.
This can be run on production databases to improve query performance.
"""

import asyncio
import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
import os
import sys

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import get_settings

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


async def add_indexes():
    """Add performance indexes to the database."""
    settings = get_settings()

    # Create engine
    engine = create_async_engine(settings.database_url, echo=True)

    # List of indexes to create
    indexes = [
        # New indexes for benchmark_results
        {
            "name": "idx_benchmark_results_name_run",
            "table": "benchmark_results",
            "columns": ["benchmark_name", "run_id"],
            "sql": "CREATE INDEX IF NOT EXISTS idx_benchmark_results_name_run ON benchmark_results(benchmark_name, run_id)",
        },
        {
            "name": "idx_benchmark_results_run_high_watermark",
            "table": "benchmark_results",
            "columns": ["run_id", "high_watermark_bytes"],
            "sql": "CREATE INDEX IF NOT EXISTS idx_benchmark_results_run_high_watermark ON benchmark_results(run_id, high_watermark_bytes)",
        },
        # New indexes for runs
        {
            "name": "idx_runs_timestamp_desc",
            "table": "runs",
            "columns": ["timestamp"],
            "sql": "CREATE INDEX IF NOT EXISTS idx_runs_timestamp_desc ON runs(timestamp DESC)",
        },
        {
            "name": "idx_runs_env_python_timestamp",
            "table": "runs",
            "columns": ["environment_id", "python_major", "python_minor", "timestamp"],
            "sql": "CREATE INDEX IF NOT EXISTS idx_runs_env_python_timestamp ON runs(environment_id, python_major, python_minor, timestamp)",
        },
    ]

    async with engine.begin() as conn:
        for index in indexes:
            try:
                logger.info(f"Creating index {index['name']} on {index['table']}...")
                await conn.execute(text(index["sql"]))
                logger.info(f"✓ Index {index['name']} created successfully")
            except Exception as e:
                logger.warning(f"⚠ Could not create index {index['name']}: {e}")

    await engine.dispose()
    logger.info("Index creation complete!")


if __name__ == "__main__":
    asyncio.run(add_indexes())
