#!/usr/bin/env python3
"""
Quick script to fix binary icons via API calls
"""

import requests
import json

# API base URL
API_BASE = "http://localhost:8000/api"

# Correct binary configurations with proper icons and colors
BINARY_CONFIGS = [
    {
        "id": "default",
        "name": "Default Build",
        "description": "Standard CPython build with default compilation settings. Used as baseline for performance comparisons.",
        "color": "#3b82f6",
        "icon": "settings",
        "display_order": 0,
    },
    {
        "id": "debug",
        "name": "Debug Build", 
        "description": "Debug build with additional runtime checks and debugging symbols. Higher memory usage but better error detection.",
        "color": "#ef4444",
        "icon": "bug",
        "display_order": 1,
    },
    {
        "id": "pgo",
        "name": "PGO Build",
        "description": "Profile Guided Optimization build. Uses runtime profiling data to optimize frequently executed code paths.",
        "color": "#6366f1", 
        "icon": "zap",
        "display_order": 2,
    },
    {
        "id": "lto",
        "name": "LTO Build",
        "description": "Link Time Optimization enabled. Performs cross-module optimizations for better performance.",
        "color": "#10b981",
        "icon": "gauge", 
        "display_order": 3,
    },
    {
        "id": "lto-pgo",
        "name": "LTO + PGO Build",
        "description": "Highly optimized build combining Link Time Optimization with Profile Guided Optimization. Maximum performance with cross-module optimizations and runtime profiling data.",
        "color": "#8b5cf6",
        "icon": "rocket",
        "display_order": 4,
    },
    {
        "id": "nogil", 
        "name": "No GIL Build",
        "description": "Experimental build without the Global Interpreter Lock (GIL). Enables true parallelism for CPU-bound tasks.",
        "color": "#f59e0b",
        "icon": "zap",
        "display_order": 5,
    },
    {
        "id": "debug-nogil",
        "name": "Debug No GIL Build", 
        "description": "Debug build combined with no-GIL features. Best for development and testing of parallel applications.",
        "color": "#a855f7",
        "icon": "shield",
        "display_order": 6,
    },
    {
        "id": "trace",
        "name": "Trace Build",
        "description": "Build with trace reference counting enabled. Useful for memory leak detection and debugging.",
        "color": "#06b6d4",
        "icon": "search",
        "display_order": 7,
    },
]

def update_binary_via_api(binary_config):
    """Update a binary via the admin API"""
    url = f"{API_BASE}/admin/binaries/{binary_config['id']}"
    
    # Prepare the update payload
    payload = {
        "name": binary_config["name"],
        "description": binary_config["description"], 
        "color": binary_config["color"],
        "icon": binary_config["icon"],
        "display_order": binary_config["display_order"]
    }
    
    try:
        response = requests.put(url, json=payload)
        if response.status_code == 200:
            print(f"✅ Updated {binary_config['id']}: {binary_config['name']} -> {binary_config['icon']}")
            return True
        else:
            print(f"❌ Failed to update {binary_config['id']}: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error updating {binary_config['id']}: {e}")
        return False

def main():
    print("🔧 Fixing binary icons and colors...")
    
    success_count = 0
    total_count = len(BINARY_CONFIGS)
    
    for config in BINARY_CONFIGS:
        if update_binary_via_api(config):
            success_count += 1
    
    print(f"\n🎉 Updated {success_count}/{total_count} binaries successfully!")
    
    # Verify the changes
    print("\n📋 Current binary icons:")
    try:
        response = requests.get(f"{API_BASE}/binaries")
        if response.status_code == 200:
            binaries = response.json()
            for binary in binaries:
                print(f"  {binary['id']}: {binary['icon']} ({binary['color']})")
        else:
            print(f"❌ Failed to fetch binaries: {response.status_code}")
    except Exception as e:
        print(f"❌ Error fetching binaries: {e}")

if __name__ == "__main__":
    main()