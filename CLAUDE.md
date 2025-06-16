# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Common Development Tasks
- `make dev` - Start both frontend (port 9002) and backend (port 8000) development servers
- `make dev-frontend` - Start frontend development server only
- `make dev-backend` - Start backend development server only  
- `make install` - Install all dependencies (frontend + backend)
- `make setup` - Complete setup: install dependencies, initialize database, populate with mock data

### Testing and Quality
- `make test` - Run backend tests with pytest
- `npm run lint` - Run Next.js linting (in frontend directory)
- `npm run typecheck` - Run TypeScript type checking (in frontend directory)

### Database Management
- `make init-db` - Initialize SQLite database with schema
- `make populate-db` - Populate database with mock data
- `make reset-db` - Drop and recreate database with fresh mock data

### Authentication Token Management
- `python backend/scripts/manage_tokens.py create "Name" --description "Purpose"` - Create new auth token
- `python backend/scripts/manage_tokens.py list` - List all existing tokens
- `python backend/scripts/manage_tokens.py analytics` - Show usage analytics dashboard
- `python backend/scripts/manage_tokens.py search --name "pattern"` - Search tokens by pattern
- `python backend/scripts/manage_tokens.py update <id> --name "New Name"` - Update token info
- `python backend/scripts/manage_tokens.py deactivate <id>` - Deactivate a token
- `python backend/scripts/manage_tokens.py cleanup --days 90` - Clean up old unused tokens

All scripts support `--database-url` for custom database connections.

### Production
- `make build` - Build frontend for production
- `make clean` - Clean up generated files and caches

## Project Architecture

### Core Components
This is a **CPython memory benchmarking and analysis tool** with three main components:

1. **Backend** (`/backend/`) - FastAPI application with SQLite database
2. **Frontend** (`/frontend/`) - Next.js React application with data visualization
3. **Worker** (`/worker/`) - Python CLI tool for running memory benchmarks (separate package)

### Backend Architecture (FastAPI + SQLite)
- **Async-first design** using SQLAlchemy async with aiosqlite
- **Repository pattern** with CRUD operations in `crud.py`
- **Layered architecture**: API routes → CRUD operations → SQLAlchemy models
- **Key models**: Commit, Binary, Run, BenchmarkResult (foreign key relationships)
- **Bulk data processing** for benchmark result ingestion via `/api/upload`
- **Complex joins** for enriched queries combining commit, binary, and benchmark data

### Frontend Architecture (Next.js 15 + App Router)
- **App Router** with TypeScript (`src/app/` directory structure)
- **Shadcn/ui + Radix UI** component library with Tailwind CSS
- **Data visualization** using Recharts for trend analysis and comparisons
- **Client-side state management** with React hooks (no global state)
- **API client** in `src/lib/api.ts` with typed endpoints
- **Theme system** with light/dark mode support

### Key Pages and Features
- **Trends** (`/trends`) - Benchmark trend visualization with filtering
- **Diff** (`/diff`) - Commit-to-commit comparison tables
- **Binaries** (`/binaries`) - Python build configuration inspection
- **Upload** (`/upload`) - Bulk benchmark data upload interface

## Development Guidelines

### Database Schema
The SQLite database tracks:
- **Commits**: Git commits with Python version metadata
- **Binaries**: Python build configurations (flags like --enable-shared, --with-computed-gotos)
- **Runs**: Benchmark execution instances linking commits to binaries
- **BenchmarkResults**: Individual memory profiling results with JSON data
- **AuthTokens**: Authentication tokens for worker upload authorization

### API Patterns
- All endpoints use `/api/` prefix
- Async FastAPI with dependency injection for database sessions
- Pydantic schemas for request/response validation
- Comprehensive error handling with custom exception classes
- **Token-based authentication** required for `/api/upload-run` endpoint
- Supports both `Bearer <token>` and `Token <token>` authorization headers

### Frontend Development
- Use TypeScript for all new code
- Follow Shadcn/ui component patterns
- Implement proper loading states and error handling
- Use `useMemo` for expensive computations (chart data processing)
- API calls should use the centralized `api.ts` client

### Testing
- Backend tests use pytest with async support
- Frontend uses Next.js built-in linting
- Always run `make test` before committing backend changes
- Use `npm run typecheck` to verify TypeScript correctness

## Environment Setup

### Backend Requirements
- Python 3.8+
- FastAPI, SQLAlchemy, Pydantic (see `requirements.txt`)
- SQLite database (created automatically)

### Frontend Requirements  
- Node.js 16+
- Next.js 15.3.3 with App Router
- Extensive UI component library (Radix UI, Shadcn/ui)

### Environment Variables
- `NEXT_PUBLIC_API_BASE` - Backend API URL (defaults to localhost:8000)
- `MEMORY_TRACKER_TOKEN` - Authentication token for worker (alternative to --auth-token)
- `DATABASE_URL` - Database connection URL (defaults to SQLite in development)

### Database URL Examples
```bash
# SQLite (default)
DATABASE_URL="sqlite+aiosqlite:///./memory_tracker.db"

# PostgreSQL
DATABASE_URL="postgresql+asyncpg://user:password@localhost/memory_tracker"

# MySQL
DATABASE_URL="mysql+aiomysql://user:password@localhost/memory_tracker"

# Use with scripts
python backend/scripts/manage_tokens.py --database-url "postgresql+asyncpg://user:pass@localhost/db" create "Token Name"
```

## Worker Usage

### Authentication
All worker operations that upload data require authentication:
```bash
# Method 1: Environment variable (recommended)
export MEMORY_TRACKER_TOKEN=your_token_here
memory-tracker benchmark ...

# Method 2: Command line argument
memory-tracker benchmark ... --auth-token your_token_here
```

### Parallel Processing
The worker supports parallel processing of multiple commits:
```bash
# Sequential processing (default)
memory-tracker benchmark /path/to/cpython HEAD~5..HEAD --binary-id default --environment-id linux-x86_64

# Parallel processing with 4 workers
memory-tracker benchmark /path/to/cpython HEAD~10..HEAD --binary-id default --environment-id linux-x86_64 -j 4

# Custom batch size for memory management
memory-tracker benchmark /path/to/cpython HEAD~20..HEAD --binary-id default --environment-id linux-x86_64 -j 4 -b 2
```

### Token Management Workflow
1. **Create token**: `python backend/scripts/manage_tokens.py create "Worker Name" --description "Purpose"`
2. **Set environment**: `export MEMORY_TRACKER_TOKEN=<generated_token>`
3. **Run benchmarks**: `memory-tracker benchmark ...`
4. **Monitor usage**: `python backend/scripts/manage_tokens.py analytics`
5. **Search/manage**: `python backend/scripts/manage_tokens.py search --active-only`
6. **Deactivate if needed**: `python backend/scripts/manage_tokens.py deactivate <token_id>`