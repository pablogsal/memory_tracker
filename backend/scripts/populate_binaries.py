#!/usr/bin/env python3
"""
Script to populate the database with the standard binary configurations for CPython Memory Tracker.
These binaries match the frontend binary types.
"""

import asyncio
import sys
import os

# Add the parent directory to the path so we can import from app
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.database import AsyncSessionLocal, create_tables
from app import schemas, crud, models


def get_standard_binaries():
    """Get the standard binary configurations that match the frontend."""
    return [
        {
            "id": "default",
            "name": "Default Build",
            "flags": [],
            "description": "Standard CPython build with default compilation settings. Used as baseline for performance comparisons."
        },
        {
            "id": "debug",
            "name": "Debug Build", 
            "flags": ["--with-debug"],
            "description": "Debug build with additional runtime checks and debugging symbols. Higher memory usage but better error detection."
        },
        {
            "id": "nogil",
            "name": "No GIL Build",
            "flags": ["--disable-gil"],
            "description": "Experimental build without the Global Interpreter Lock (GIL). Enables true parallelism for CPU-bound tasks."
        },
        {
            "id": "debug-nogil",
            "name": "Debug No GIL Build",
            "flags": ["--with-debug", "--disable-gil"],
            "description": "Debug build combined with no-GIL features. Best for development and testing of parallel applications."
        },
        {
            "id": "lto",
            "name": "LTO Build",
            "flags": ["--with-lto"],
            "description": "Link Time Optimization enabled. Performs cross-module optimizations for better performance."
        },
        {
            "id": "pgo",
            "name": "PGO Build",
            "flags": ["--enable-optimizations"],
            "description": "Profile Guided Optimization build. Uses runtime profiling data to optimize frequently executed code paths."
        },
        {
            "id": "trace",
            "name": "Trace Build",
            "flags": ["--with-trace-refs"],
            "description": "Build with trace reference counting enabled. Useful for memory leak detection and debugging."
        },
        {
            "id": "lto-pgo",
            "name": "LTO + PGO Build",
            "flags": ["--with-lto", "--enable-optimizations"],
            "description": "Highly optimized build combining Link Time Optimization with Profile Guided Optimization. Maximum performance with cross-module optimizations and runtime profiling data."
        }
    ]


async def populate_binaries(force: bool = False):
    """Populate the database with standard binary configurations."""
    # Ensure database tables exist
    await create_tables()
    
    async with AsyncSessionLocal() as db:
        try:
            binaries_data = get_standard_binaries()
            created_count = 0
            updated_count = 0
            skipped_count = 0
            
            print(f"Populating {len(binaries_data)} standard binary configurations...")
            
            for binary_data in binaries_data:
                binary_id = binary_data["id"]
                
                # Check if binary already exists
                existing_binary = await crud.get_binary_by_id(db, binary_id=binary_id)
                
                if existing_binary:
                    if force:
                        # Update existing binary
                        existing_binary.name = binary_data["name"]
                        existing_binary.flags = binary_data["flags"]
                        existing_binary.description = binary_data["description"]
                        await db.commit()
                        print(f"✅ Updated binary '{binary_id}': {binary_data['name']}")
                        print(f"   Flags: {binary_data['flags']}")
                        print(f"   Description: {binary_data['description']}")
                        updated_count += 1
                    else:
                        print(f"⚠️  Binary '{binary_id}' already exists (use --force to update)")
                        print(f"   Current: {existing_binary.name} with flags {existing_binary.flags}")
                        skipped_count += 1
                else:
                    # Create new binary
                    binary_create = schemas.BinaryCreate(
                        id=binary_id,
                        name=binary_data["name"],
                        flags=binary_data["flags"],
                        description=binary_data["description"]
                    )
                    
                    new_binary = await crud.create_binary(db, binary_create)
                    print(f"✅ Created binary '{binary_id}': {binary_data['name']}")
                    print(f"   Flags: {binary_data['flags']}")
                    print(f"   Description: {binary_data['description']}")
                    created_count += 1
            
            print(f"\n🎉 Binary population completed!")
            print(f"   - Created: {created_count} binaries")
            print(f"   - Updated: {updated_count} binaries")
            print(f"   - Skipped: {skipped_count} binaries")
            
            return True
            
        except Exception as e:
            print(f"❌ Error populating binaries: {e}")
            await db.rollback()
            return False


async def list_binaries():
    """List all currently registered binaries."""
    # Ensure database tables exist
    await create_tables()
    
    async with AsyncSessionLocal() as db:
        try:
            binaries = await crud.get_binaries(db)
            
            if not binaries:
                print("No binaries currently registered.")
                return
            
            print("Currently registered binaries:")
            for binary in binaries:
                flags_str = " ".join(binary.flags) if binary.flags else "none"
                print(f"  - {binary.id}: {binary.name} (flags: {flags_str})")
                
        except Exception as e:
            print(f"❌ Error listing binaries: {e}")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Populate database with standard binary configurations",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
This script creates the standard set of binary configurations that match the frontend:
  - default: Standard CPython build (baseline)
  - debug: Debug build with runtime checks
  - nogil: Experimental no-GIL build  
  - debug-nogil: Debug + no-GIL combination
  - lto: Link Time Optimization enabled
  - pgo: Profile Guided Optimization  
  - lto-pgo: Highly optimized LTO + PGO combination
  - trace: Trace reference counting
  - valgrind: Valgrind-optimized build

Examples:
  # Populate standard binaries
  python populate_binaries.py
  
  # Force update existing binaries
  python populate_binaries.py --force
  
  # List current binaries
  python populate_binaries.py --list
"""
    )
    
    parser.add_argument(
        '--force', '-f',
        action='store_true',
        help='Force update existing binaries with new configurations'
    )
    parser.add_argument(
        '--list', '-l',
        action='store_true',
        help='List all currently registered binaries'
    )
    
    args = parser.parse_args()
    
    if args.list:
        success = asyncio.run(list_binaries())
    else:
        success = asyncio.run(populate_binaries(force=args.force))
        if not success:
            sys.exit(1)


if __name__ == "__main__":
    main()