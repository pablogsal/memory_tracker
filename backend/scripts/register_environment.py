#!/usr/bin/env python3
"""
Script to register new environment configurations in the CPython Memory Tracker database.
"""

import asyncio
import sys
import os
import argparse

# Add the parent directory to the path so we can import from app
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import AsyncSessionLocal
from app import schemas, crud


async def register_environment(
    environment_id: str, name: str, description: str = None
) -> bool:
    """Register a new environment configuration."""
    async with AsyncSessionLocal() as db:
        try:
            # Check if environment already exists
            existing_env = await crud.get_environment_by_id(
                db, environment_id=environment_id
            )
            if existing_env:
                print(f"❌ Environment '{environment_id}' already exists")
                print(f"   Name: {existing_env.name}")
                print(f"   Description: {existing_env.description}")
                return False

            # Create new environment
            env_data = schemas.EnvironmentCreate(
                id=environment_id, name=name, description=description
            )

            new_env = await crud.create_environment(db, env_data)

            print(f"✅ Successfully registered environment '{environment_id}'")
            print(f"   Name: {new_env.name}")
            if new_env.description:
                print(f"   Description: {new_env.description}")

            return True

        except Exception as e:
            print(f"❌ Error registering environment: {e}")
            return False


async def list_environments():
    """List all registered environments."""
    async with AsyncSessionLocal() as db:
        try:
            environments = await crud.get_environments(db)

            if not environments:
                print("No environments registered.")
                return

            print("Registered environments:")
            for env in environments:
                desc_str = f" ({env.description})" if env.description else ""
                print(f"  - {env.id}: {env.name}{desc_str}")

        except Exception as e:
            print(f"❌ Error listing environments: {e}")


def main():
    parser = argparse.ArgumentParser(
        description="Register environment configurations for CPython Memory Tracker",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Register a Linux environment
  python register_environment.py linux-x86_64 "Linux x86_64" --description "Ubuntu 22.04 with GCC 11"

  # Register a macOS environment
  python register_environment.py macos-arm64 "macOS ARM64" --description "Apple Silicon M1/M2"
  
  # Register an environment without description
  python register_environment.py windows-x86_64 "Windows x86_64"
  
  # List all registered environments
  python register_environment.py --list
""",
    )

    parser.add_argument(
        "environment_id",
        nargs="?",
        help="Unique identifier for the environment (e.g., linux-x86_64, macos-arm64)",
    )
    parser.add_argument(
        "name",
        nargs="?",
        help='Human-readable name for the environment (e.g., "Linux x86_64")',
    )
    parser.add_argument(
        "--description",
        "-d",
        help='Optional description of the environment (e.g., "Ubuntu 22.04 with GCC 11")',
    )
    parser.add_argument(
        "--list", "-l", action="store_true", help="List all registered environments"
    )

    args = parser.parse_args()

    if args.list:
        asyncio.run(list_environments())
    elif args.environment_id and args.name:
        asyncio.run(
            register_environment(args.environment_id, args.name, args.description)
        )
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
