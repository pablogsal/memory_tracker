"""
Optimized CRUD operations using eager loading and better query patterns.
"""
from sqlalchemy import select, desc, and_, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload, contains_eager
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging

from . import models

logger = logging.getLogger(__name__)


async def get_enriched_benchmark_results_optimized(
    db: AsyncSession,
    benchmark_name: Optional[str] = None,
    binary_id: Optional[str] = None,
    environment_id: Optional[str] = None,
    python_major: Optional[int] = None,
    python_minor: Optional[int] = None,
    skip: int = 0,
    limit: int = 100
) -> List[models.BenchmarkResult]:
    """
    Get benchmark results with all related data using eager loading.
    This avoids N+1 queries when accessing related objects.
    """
    # Build the query with eager loading
    query = (
        select(models.BenchmarkResult)
        .join(models.Run)
        .join(models.Commit)
        .join(models.Binary)
        .join(models.Environment)
        .options(
            # Use joinedload for one-to-one relationships
            joinedload(models.BenchmarkResult.run)
            .joinedload(models.Run.commit),
            joinedload(models.BenchmarkResult.run)
            .joinedload(models.Run.binary),
            joinedload(models.BenchmarkResult.run)
            .joinedload(models.Run.environment)
        )
        .order_by(desc(models.Commit.timestamp))
    )
    
    # Apply filters
    if benchmark_name:
        query = query.where(models.BenchmarkResult.benchmark_name == benchmark_name)
    if binary_id:
        query = query.where(models.Run.binary_id == binary_id)
    if environment_id:
        query = query.where(models.Run.environment_id == environment_id)
    if python_major is not None:
        query = query.where(models.Commit.python_major == python_major)
    if python_minor is not None:
        query = query.where(models.Commit.python_minor == python_minor)
    
    # Apply pagination
    query = query.offset(skip).limit(limit)
    
    # Execute query
    result = await db.execute(query)
    return result.scalars().unique().all()


async def get_runs_with_related_data(
    db: AsyncSession,
    commit_sha: Optional[str] = None,
    binary_id: Optional[str] = None,
    environment_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
) -> List[models.Run]:
    """
    Get runs with commit, binary, and environment data pre-loaded.
    """
    query = (
        select(models.Run)
        .options(
            selectinload(models.Run.commit),
            selectinload(models.Run.binary),
            selectinload(models.Run.environment),
            selectinload(models.Run.benchmark_results)
        )
        .order_by(desc(models.Run.timestamp))
    )
    
    if commit_sha:
        query = query.where(models.Run.commit_sha == commit_sha)
    if binary_id:
        query = query.where(models.Run.binary_id == binary_id)
    if environment_id:
        query = query.where(models.Run.environment_id == environment_id)
    
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    return result.scalars().unique().all()


async def get_commits_with_run_counts(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100
) -> List[Dict[str, Any]]:
    """
    Get commits with the count of associated runs.
    Uses a single query with aggregation instead of N+1 queries.
    """
    query = (
        select(
            models.Commit,
            func.count(models.Run.run_id).label('run_count')
        )
        .outerjoin(models.Run)
        .group_by(models.Commit.sha)
        .order_by(desc(models.Commit.timestamp))
        .offset(skip)
        .limit(limit)
    )
    
    result = await db.execute(query)
    
    commits_with_counts = []
    for commit, run_count in result:
        commits_with_counts.append({
            'commit': commit,
            'run_count': run_count
        })
    
    return commits_with_counts


async def get_benchmark_trends_optimized(
    db: AsyncSession,
    benchmark_name: str,
    binary_id: str,
    environment_id: str,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """
    Get benchmark trends using a more efficient query.
    Returns data points for charting benchmark performance over time.
    """
    # Use a CTE (Common Table Expression) for better performance
    query = text("""
        WITH recent_commits AS (
            SELECT DISTINCT c.sha, c.timestamp, c.python_major, c.python_minor, c.python_patch
            FROM commits c
            JOIN runs r ON c.sha = r.commit_sha
            JOIN benchmark_results br ON r.run_id = br.run_id
            WHERE r.binary_id = :binary_id
              AND r.environment_id = :environment_id
              AND br.benchmark_name = :benchmark_name
            ORDER BY c.timestamp DESC
            LIMIT :limit
        )
        SELECT 
            rc.sha,
            rc.timestamp,
            rc.python_major,
            rc.python_minor,
            rc.python_patch,
            br.high_watermark_bytes,
            br.total_allocated_bytes
        FROM recent_commits rc
        JOIN runs r ON rc.sha = r.commit_sha
        JOIN benchmark_results br ON r.run_id = br.run_id
        WHERE r.binary_id = :binary_id
          AND r.environment_id = :environment_id
          AND br.benchmark_name = :benchmark_name
        ORDER BY rc.timestamp ASC
    """)
    
    result = await db.execute(
        query,
        {
            'benchmark_name': benchmark_name,
            'binary_id': binary_id,
            'environment_id': environment_id,
            'limit': limit
        }
    )
    
    trends = []
    for row in result:
        trends.append({
            'sha': row.sha,
            'timestamp': row.timestamp,
            'python_version': f"{row.python_major}.{row.python_minor}.{row.python_patch}",
            'high_watermark_bytes': row.high_watermark_bytes,
            'total_allocated_bytes': row.total_allocated_bytes
        })
    
    return trends


async def bulk_insert_benchmark_results(
    db: AsyncSession,
    results: List[Dict[str, Any]]
) -> int:
    """
    Efficiently bulk insert benchmark results.
    Uses SQLAlchemy Core for better performance with large datasets.
    """
    if not results:
        return 0
    
    # Use bulk_insert_mappings for better performance
    db.add_all([
        models.BenchmarkResult(**result)
        for result in results
    ])
    
    await db.commit()
    return len(results)