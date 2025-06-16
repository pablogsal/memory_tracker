#!/usr/bin/env python3
"""
Database population script for CPython Memory Tracker.
This script populates the database with mock data for testing and development.
"""

import asyncio
import sys
import os
import random
from datetime import datetime, timedelta
from typing import List

# Add the parent directory to the path so we can import from app
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.database import AsyncSessionLocal
from app import models, schemas, crud


# Mock data generators
def generate_commits(count: int = 200) -> List[schemas.CommitCreate]:
    """Generate mock commits with realistic data."""
    authors = [
        "Alice Wonderland", "Bob The Builder", "Carol Danvers", 
        "David Copperfield", "Eve Harrington", "Frank Sinatra",
        "Grace Hopper", "Henry Ford", "Iris Chang", "Jack Sparrow"
    ]
    
    python_versions = [
        (3, 11, 0), (3, 11, 1), (3, 11, 2), (3, 11, 3),
        (3, 12, 0), (3, 12, 1), (3, 12, 2), (3, 12, 3), (3, 12, 4), (3, 12, 5),
        (3, 13, 0), (3, 13, 1)
    ]
    
    messages = [
        "Initial commit", "Add performance optimization", "Fix memory leak",
        "Refactor allocation logic", "Update benchmarking suite", "Optimize hot path",
        "Add new benchmark tests", "Fix regression in memory usage", 
        "Improve garbage collection", "Add debug logging", "Release version",
        "Fix critical bug", "Performance improvements", "Code cleanup",
        "Add feature", "Update dependencies", "Security fix"
    ]
    
    commits = []
    base_time = datetime.now()
    
    for i in range(count):
        major, minor, patch = random.choice(python_versions)
        days_ago = i * random.uniform(0.5, 3.0)  # Commits spread over time
        
        commit = schemas.CommitCreate(
            sha=f"{random.randint(10000000, 99999999):08x}",
            timestamp=base_time - timedelta(days=days_ago),
            message=f"{random.choice(messages)} (Python {major}.{minor})",
            author=random.choice(authors),
            python_version=schemas.PythonVersion(major=major, minor=minor, patch=patch)
        )
        commits.append(commit)
    
    # Sort by timestamp (newest first)
    commits.sort(key=lambda c: c.timestamp, reverse=True)
    return commits


def generate_binaries() -> List[schemas.BinaryCreate]:
    """Generate standard binary configurations."""
    return [
        schemas.BinaryCreate(id="default", name="Default", flags=[]),
        schemas.BinaryCreate(id="debug", name="Debug", flags=["--with-debug"]),
        schemas.BinaryCreate(id="nogil", name="No GIL", flags=["--disable-gil"]),
        schemas.BinaryCreate(id="debug-nogil", name="Debug & No GIL", flags=["--with-debug", "--disable-gil"]),
        schemas.BinaryCreate(id="lto", name="LTO Enabled", flags=["--with-lto"]),
        schemas.BinaryCreate(id="pgo", name="PGO Optimized", flags=["--enable-optimizations"]),
        schemas.BinaryCreate(id="trace", name="Trace Enabled", flags=["--with-trace-refs"]),
        schemas.BinaryCreate(id="valgrind", name="Valgrind", flags=["--with-valgrind"]),
    ]


def generate_runs(commits: List[models.Commit], binaries: List[models.Binary], runs_per_commit: int = 6) -> List[schemas.RunCreate]:
    """Generate runs for commits and binaries."""
    runs = []
    
    for commit in commits:
        # Randomly select binaries for this commit
        selected_binaries = random.sample(binaries, min(runs_per_commit, len(binaries)))
        
        for i, binary in enumerate(selected_binaries):
            run_id = f"run_{commit.sha[:8]}_{binary.id}_{i}"
            # Run timestamp is slightly after commit timestamp
            run_timestamp = commit.timestamp + timedelta(minutes=random.randint(5, 60))
            
            run = schemas.RunCreate(
                run_id=run_id,
                commit_sha=commit.sha,
                binary_id=binary.id,
                python_version=schemas.PythonVersion(
                    major=commit.python_major,
                    minor=commit.python_minor,
                    patch=commit.python_patch
                ),
                timestamp=run_timestamp
            )
            runs.append(run)
    
    return runs


def generate_benchmark_results(runs: List[models.Run]) -> List[schemas.BenchmarkResultCreate]:
    """Generate benchmark results for runs."""
    benchmark_names = [
        "pyperformance_go", "pyperformance_json_dumps", "pyperformance_regex_dna",
        "custom_memory_test_A", "custom_memory_test_B", "startup_time", 
        "threading_overhead", "dict_operations", "list_operations",
        "string_operations", "file_io", "network_io"
    ]
    
    results = []
    
    for run in runs:
        # Each run has results for most benchmarks (more complete data)
        selected_benchmarks = random.sample(benchmark_names, random.randint(8, len(benchmark_names)))
        
        for benchmark in selected_benchmarks:
            # Generate realistic benchmark data with some variation
            base_memory = random.randint(500000, 5000000)  # 500KB to 5MB
            variation = random.uniform(0.8, 1.2)
            
            # Add some correlation with binary type
            if "debug" in run.binary_id:
                variation *= 1.3  # Debug builds use more memory
            if "nogil" in run.binary_id:
                variation *= 0.9  # No-GIL might be slightly more efficient
            if "lto" in run.binary_id or "pgo" in run.binary_id:
                variation *= 0.95  # Optimized builds use less memory
            
            high_watermark = int(base_memory * variation)
            total_allocated = int(high_watermark * random.uniform(1.5, 3.0))
            
            # Generate allocation histogram
            histogram = []
            for size in [16, 32, 64, 128, 256, 512, 1024]:
                count = int(1000 * random.uniform(0.1, 2.0) / (size / 16))
                if count > 0:
                    histogram.append([size, count])
            
            # Generate top allocating functions
            functions = ["malloc", "PyObject_Malloc", "new_object", "list_append", "dict_setitem"]
            top_functions = []
            remaining_size = total_allocated
            
            for func in random.sample(functions, min(3, len(functions))):
                func_size = int(remaining_size * random.uniform(0.1, 0.4))
                func_count = int(func_size / random.randint(100, 1000))
                top_functions.append({
                    "function": func,
                    "count": func_count,
                    "total_size": func_size
                })
                remaining_size -= func_size
                if remaining_size <= 0:
                    break
            
            result_json = schemas.BenchmarkResultJson(
                high_watermark_bytes=high_watermark,
                allocation_histogram=histogram,
                total_allocated_bytes=total_allocated,
                top_allocating_functions=[
                    schemas.TopAllocatingFunction(**func) for func in top_functions
                ],
                benchmark_name=benchmark
            )
            
            result = schemas.BenchmarkResultCreate(
                run_id=run.run_id,
                benchmark_name=benchmark,
                result_json=result_json
            )
            results.append(result)
    
    return results


async def populate_database():
    """Populate the database with mock data using efficient bulk inserts."""
    print("Populating database with mock data...")
    
    async with AsyncSessionLocal() as db:
        try:
            # Generate commits: 100 per version (3 versions) = 300 total
            print("Creating commits...")
            python_versions = [
                (3, 11, 0), (3, 12, 0), (3, 13, 0)
            ]
            
            all_commits = []
            for major, minor, patch in python_versions:
                version_commits = generate_commits_for_version(100, major, minor, patch)
                all_commits.extend(version_commits)
            
            # Bulk insert commits
            commit_objects = [
                models.Commit(
                    sha=commit.sha,
                    timestamp=commit.timestamp,
                    message=commit.message,
                    author=commit.author,
                    python_major=commit.python_version.major,
                    python_minor=commit.python_version.minor,
                    python_patch=commit.python_version.patch,
                )
                for commit in all_commits
            ]
            db.add_all(commit_objects)
            await db.flush()  # Get IDs without committing
            print(f"✅ Created {len(commit_objects)} commits")
            
            # Generate and bulk insert binaries
            print("Creating binaries...")
            binary_data = generate_binaries()
            binary_objects = [
                models.Binary(id=binary.id, name=binary.name, flags=binary.flags)
                for binary in binary_data
            ]
            db.add_all(binary_objects)
            await db.flush()
            print(f"✅ Created {len(binary_objects)} binaries")
            
            # Generate runs: each commit x each binary = massive bulk insert
            print("Creating runs...")
            run_objects = []
            run_counter = 0
            
            for commit_obj in commit_objects:
                for binary_obj in binary_objects:
                    run_id = f"run_{commit_obj.sha[:8]}_{binary_obj.id}_{run_counter}"
                    run_timestamp = commit_obj.timestamp + timedelta(minutes=random.randint(5, 60))
                    
                    run_objects.append(models.Run(
                        run_id=run_id,
                        commit_sha=commit_obj.sha,
                        binary_id=binary_obj.id,
                        python_major=commit_obj.python_major,
                        python_minor=commit_obj.python_minor,
                        python_patch=commit_obj.python_patch,
                        timestamp=run_timestamp,
                    ))
                    run_counter += 1
            
            # Bulk insert runs in batches to avoid memory issues
            batch_size = 1000
            for i in range(0, len(run_objects), batch_size):
                batch = run_objects[i:i+batch_size]
                db.add_all(batch)
                await db.flush()
                print(f"   Inserted runs batch {i//batch_size + 1}/{(len(run_objects)-1)//batch_size + 1}")
            
            print(f"✅ Created {len(run_objects)} runs")
            
            # Generate benchmark results in bulk
            print("Creating benchmark results...")
            benchmark_names = [
                "pyperformance_go", "pyperformance_json_dumps", "pyperformance_regex_dna",
                "custom_memory_test_A", "custom_memory_test_B", "startup_time", 
                "threading_overhead", "dict_operations", "list_operations",
                "string_operations", "file_io", "network_io"
            ]
            
            result_objects = []
            result_counter = 0
            
            for run_obj in run_objects:
                # Each run gets 8-12 benchmark results
                selected_benchmarks = random.sample(benchmark_names, random.randint(8, len(benchmark_names)))
                
                for benchmark_name in selected_benchmarks:
                    result_id = f"{run_obj.run_id}_{benchmark_name.replace('_', '-')}"
                    
                    # Create realistic trends based on commit age and benchmark type
                    commit_age_days = (datetime.now() - run_obj.timestamp).days
                    
                    # Base memory values per benchmark (realistic baselines)
                    benchmark_baselines = {
                        "pyperformance_go": 2500000,
                        "pyperformance_json_dumps": 1500000,
                        "pyperformance_regex_dna": 800000,
                        "custom_memory_test_A": 3000000,
                        "custom_memory_test_B": 2000000,
                        "startup_time": 500000,
                        "threading_overhead": 1200000,
                        "dict_operations": 900000,
                        "list_operations": 1100000,
                        "string_operations": 700000,
                        "file_io": 1800000,
                        "network_io": 2200000
                    }
                    
                    base_memory = benchmark_baselines.get(benchmark_name, 1000000)
                    
                    # Create gradual improvement trend over time (newer commits = better performance)
                    trend_factor = 1.0 + (commit_age_days * 0.002)  # ~0.2% worse per day older
                    
                    # Add some realistic noise (±5%)
                    noise = random.uniform(0.95, 1.05)
                    
                    # Binary-specific consistent effects
                    binary_factor = 1.0
                    if "debug" in run_obj.binary_id:
                        binary_factor = 1.35  # Debug consistently uses more memory
                    elif "nogil" in run_obj.binary_id:
                        binary_factor = 0.92  # No-GIL slightly better
                    elif "lto" in run_obj.binary_id:
                        binary_factor = 0.88  # LTO optimized significantly better
                    elif "pgo" in run_obj.binary_id:
                        binary_factor = 0.85  # PGO even better
                    elif "valgrind" in run_obj.binary_id:
                        binary_factor = 1.45  # Valgrind overhead
                    
                    # Python version effects
                    version_factor = 1.0
                    if run_obj.python_major == 3 and run_obj.python_minor == 13:
                        version_factor = 0.95  # Python 3.13 slightly more efficient
                    elif run_obj.python_major == 3 and run_obj.python_minor == 11:
                        version_factor = 1.08  # Python 3.11 slightly less efficient
                    
                    high_watermark = int(base_memory * trend_factor * noise * binary_factor * version_factor)
                    total_allocated = int(high_watermark * random.uniform(2.2, 2.8))  # More consistent ratio
                    
                    # Simple histogram and top functions
                    histogram = [[16, random.randint(100, 1000)], [32, random.randint(50, 500)], [64, random.randint(20, 200)]]
                    top_functions = [
                        {"function": "malloc", "count": random.randint(100, 1000), "total_size": random.randint(10000, 100000)},
                        {"function": "PyObject_Malloc", "count": random.randint(50, 500), "total_size": random.randint(5000, 50000)},
                    ]
                    
                    result_objects.append(models.BenchmarkResult(
                        id=result_id,
                        run_id=run_obj.run_id,
                        benchmark_name=benchmark_name,
                        high_watermark_bytes=high_watermark,
                        allocation_histogram=histogram,
                        total_allocated_bytes=total_allocated,
                        top_allocating_functions=top_functions,
                    ))
                    result_counter += 1
            
            # Bulk insert benchmark results in batches
            for i in range(0, len(result_objects), batch_size):
                batch = result_objects[i:i+batch_size]
                db.add_all(batch)
                await db.flush()
                print(f"   Inserted benchmark results batch {i//batch_size + 1}/{(len(result_objects)-1)//batch_size + 1}")
            
            print(f"✅ Created {len(result_objects)} benchmark results")
            
            # Commit everything at once
            await db.commit()
            
            print(f"\n🎉 Database populated successfully!")
            print(f"   - {len(commit_objects)} commits (100 per Python version)")
            print(f"   - {len(binary_objects)} binaries")
            print(f"   - {len(run_objects)} runs (every commit × every binary)")
            print(f"   - {len(result_objects)} benchmark results")
            
        except Exception as e:
            print(f"❌ Error populating database: {e}")
            await db.rollback()
            return False
    
    return True


def generate_commits_for_version(count: int, major: int, minor: int, patch: int) -> List[schemas.CommitCreate]:
    """Generate commits for a specific Python version."""
    authors = [
        "Alice Wonderland", "Bob The Builder", "Carol Danvers", 
        "David Copperfield", "Eve Harrington", "Frank Sinatra",
        "Grace Hopper", "Henry Ford", "Iris Chang", "Jack Sparrow"
    ]
    
    messages = [
        "Initial commit", "Add performance optimization", "Fix memory leak",
        "Refactor allocation logic", "Update benchmarking suite", "Optimize hot path",
        "Add new benchmark tests", "Fix regression in memory usage", 
        "Improve garbage collection", "Add debug logging", "Release version",
        "Fix critical bug", "Performance improvements", "Code cleanup",
        "Add feature", "Update dependencies", "Security fix"
    ]
    
    commits = []
    base_time = datetime.now()
    
    for i in range(count):
        days_ago = i * random.uniform(0.1, 1.0)  # More frequent commits
        
        commit = schemas.CommitCreate(
            sha=f"{random.randint(10000000, 99999999):08x}",
            timestamp=base_time - timedelta(days=days_ago),
            message=f"{random.choice(messages)} (Python {major}.{minor})",
            author=random.choice(authors),
            python_version=schemas.PythonVersion(major=major, minor=minor, patch=patch)
        )
        commits.append(commit)
    
    # Sort by timestamp (newest first)
    commits.sort(key=lambda c: c.timestamp, reverse=True)
    return commits


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Populate database with mock data')
    parser.add_argument('--clear-first', action='store_true', help='Clear existing data first')
    
    args = parser.parse_args()
    
    if args.clear_first:
        print("Clearing existing data...")
        # This would require implementing a clear function
        pass
    
    success = asyncio.run(populate_database())
    
    if not success:
        sys.exit(1)