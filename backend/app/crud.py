from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, and_, func
from sqlalchemy.orm import selectinload
from typing import List, Optional, Dict, Any
from datetime import datetime
from . import models, schemas


async def get_commits(db: AsyncSession, skip: int = 0, limit: int = 100) -> List[models.Commit]:
    result = await db.execute(
        select(models.Commit)
        .order_by(desc(models.Commit.timestamp))
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


async def get_commit_by_sha(db: AsyncSession, sha: str) -> Optional[models.Commit]:
    result = await db.execute(select(models.Commit).where(models.Commit.sha == sha))
    return result.scalars().first()


async def create_commit(db: AsyncSession, commit: schemas.CommitCreate) -> models.Commit:
    db_commit = models.Commit(
        sha=commit.sha,
        timestamp=commit.timestamp,
        message=commit.message,
        author=commit.author,
        python_major=commit.python_version.major,
        python_minor=commit.python_version.minor,
        python_patch=commit.python_version.patch,
    )
    db.add(db_commit)
    await db.commit()
    await db.refresh(db_commit)
    return db_commit


async def get_binaries(db: AsyncSession) -> List[models.Binary]:
    result = await db.execute(select(models.Binary))
    return result.scalars().all()


async def get_binary_by_id(db: AsyncSession, binary_id: str) -> Optional[models.Binary]:
    result = await db.execute(select(models.Binary).where(models.Binary.id == binary_id))
    return result.scalars().first()


async def create_binary(db: AsyncSession, binary: schemas.BinaryCreate) -> models.Binary:
    db_binary = models.Binary(
        id=binary.id,
        name=binary.name,
        flags=binary.flags,
    )
    db.add(db_binary)
    await db.commit()
    await db.refresh(db_binary)
    return db_binary


async def get_runs(
    db: AsyncSession, 
    commit_sha: Optional[str] = None,
    binary_id: Optional[str] = None,
    skip: int = 0, 
    limit: int = 100
) -> List[models.Run]:
    query = select(models.Run).order_by(desc(models.Run.timestamp))
    
    if commit_sha:
        query = query.where(models.Run.commit_sha == commit_sha)
    if binary_id:
        query = query.where(models.Run.binary_id == binary_id)
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def create_run(db: AsyncSession, run: schemas.RunCreate) -> models.Run:
    db_run = models.Run(
        run_id=run.run_id,
        commit_sha=run.commit_sha,
        binary_id=run.binary_id,
        python_major=run.python_version.major,
        python_minor=run.python_version.minor,
        python_patch=run.python_version.patch,
        timestamp=run.timestamp,
    )
    db.add(db_run)
    await db.commit()
    await db.refresh(db_run)
    return db_run


async def get_benchmark_results(
    db: AsyncSession,
    run_id: Optional[str] = None,
    benchmark_name: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
) -> List[models.BenchmarkResult]:
    query = select(models.BenchmarkResult)
    
    if run_id:
        query = query.where(models.BenchmarkResult.run_id == run_id)
    if benchmark_name:
        query = query.where(models.BenchmarkResult.benchmark_name == benchmark_name)
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def create_benchmark_result(db: AsyncSession, result: schemas.BenchmarkResultCreate) -> models.BenchmarkResult:
    result_id = f"{result.run_id}_{result.benchmark_name.replace('_', '-')}"
    
    db_result = models.BenchmarkResult(
        id=result_id,
        run_id=result.run_id,
        benchmark_name=result.benchmark_name,
        high_watermark_bytes=result.result_json.high_watermark_bytes,
        allocation_histogram=result.result_json.allocation_histogram,
        total_allocated_bytes=result.result_json.total_allocated_bytes,
        top_allocating_functions=[func.dict() for func in result.result_json.top_allocating_functions],
    )
    db.add(db_result)
    await db.commit()
    await db.refresh(db_result)
    return db_result


async def get_enriched_benchmark_results(
    db: AsyncSession,
    benchmark_name: Optional[str] = None,
    binary_id: Optional[str] = None,
    python_major: Optional[int] = None,
    python_minor: Optional[int] = None,
    skip: int = 0,
    limit: int = 100
) -> List[Dict[str, Any]]:
    query = (
        select(models.BenchmarkResult, models.Run, models.Commit, models.Binary)
        .join(models.Run, models.BenchmarkResult.run_id == models.Run.run_id)
        .join(models.Commit, models.Run.commit_sha == models.Commit.sha)
        .join(models.Binary, models.Run.binary_id == models.Binary.id)
        .order_by(desc(models.Commit.timestamp))
    )
    
    if benchmark_name:
        query = query.where(models.BenchmarkResult.benchmark_name == benchmark_name)
    if binary_id:
        query = query.where(models.Binary.id == binary_id)
    if python_major is not None:
        query = query.where(models.Commit.python_major == python_major)
    if python_minor is not None:
        query = query.where(models.Commit.python_minor == python_minor)
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    
    enriched_results = []
    for benchmark_result, run, commit, binary in result:
        enriched_results.append({
            "id": benchmark_result.id,
            "run_id": benchmark_result.run_id,
            "benchmark_name": benchmark_result.benchmark_name,
            "result_json": {
                "high_watermark_bytes": benchmark_result.high_watermark_bytes,
                "allocation_histogram": benchmark_result.allocation_histogram,
                "total_allocated_bytes": benchmark_result.total_allocated_bytes,
                "top_allocating_functions": benchmark_result.top_allocating_functions,
            },
            "commit": {
                "sha": commit.sha,
                "timestamp": commit.timestamp,
                "message": commit.message,
                "author": commit.author,
                "python_version": {
                    "major": commit.python_major,
                    "minor": commit.python_minor,
                    "patch": commit.python_patch,
                }
            },
            "binary": {
                "id": binary.id,
                "name": binary.name,
                "flags": binary.flags,
            },
            "run_python_version": {
                "major": run.python_major,
                "minor": run.python_minor,
                "patch": run.python_patch,
            }
        })
    
    return enriched_results


async def get_python_version_filters(db: AsyncSession) -> List[Dict[str, Any]]:
    result = await db.execute(
        select(
            models.Commit.python_major,
            models.Commit.python_minor,
        ).distinct().order_by(desc(models.Commit.python_major), desc(models.Commit.python_minor))
    )
    
    versions = []
    for major, minor in result:
        versions.append({
            "label": f"{major}.{minor}",
            "major": major,
            "minor": minor,
        })
    
    return versions


async def get_previous_commit_with_binary(db: AsyncSession, current_commit: models.Commit, binary_id: str) -> Optional[models.Commit]:
    """
    Efficiently find the previous commit that:
    1. Has an earlier timestamp than the current commit
    2. Has the same Python major.minor version
    3. Was tested with the same binary configuration
    """
    result = await db.execute(
        select(models.Commit)
        .join(models.Run, models.Commit.sha == models.Run.commit_sha)
        .where(
            and_(
                models.Commit.timestamp < current_commit.timestamp,
                models.Commit.python_major == current_commit.python_major,
                models.Commit.python_minor == current_commit.python_minor,
                models.Run.binary_id == binary_id
            )
        )
        .order_by(desc(models.Commit.timestamp))
        .limit(1)
    )
    return result.scalars().first()