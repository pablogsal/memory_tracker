# CPython Memory Tracker

A comprehensive memory benchmarking and analysis tool for CPython builds, featuring a FastAPI backend with SQLite database and a Next.js frontend.

## Features

- **Benchmark Trend Visualization**: Display memory benchmark trends over time, filtering by Python version, binary flags, and benchmark name
- **Diff Table View**: Show commit-to-commit comparisons with metric deltas and color-coding
- **Binary Configuration Management**: View and manage compilation flag configurations
- **Data Upload API**: Upload new benchmark results via API endpoints
- **Real-time Analysis**: Interactive charts and tables for performance analysis

## Project Structure

```
memory_tracker/
├── frontend/           # Next.js React frontend
│   ├── src/
│   │   ├── app/       # Next.js 13+ app router pages
│   │   ├── components/ # Reusable UI components
│   │   └── lib/       # Utilities, types, and API client
│   └── package.json
├── backend/           # FastAPI backend
│   ├── app/          # FastAPI application
│   │   ├── models.py    # SQLAlchemy models
│   │   ├── schemas.py   # Pydantic schemas
│   │   ├── crud.py      # Database operations
│   │   ├── database.py  # Database configuration
│   │   └── main.py      # FastAPI app and routes
│   ├── scripts/      # Database management scripts
│   │   ├── init_db.py     # Database initialization
│   │   └── populate_db.py # Mock data population
│   └── requirements.txt
└── Makefile          # Development commands
```

## Quick Start

### Prerequisites

- Python 3.8+
- Node.js 16+
- Virtual environment (recommended)

### Setup

1. **Clone and navigate to the project:**
   ```bash
   cd memory_tracker
   ```

2. **Install all dependencies:**
   ```bash
   make install
   ```

3. **Initialize and populate the database:**
   ```bash
   make setup
   ```

4. **Start development servers:**
   ```bash
   make dev
   ```

   This starts both:
   - Backend API at http://localhost:8000
   - Frontend at http://localhost:3000

### Manual Setup (Alternative)

If you prefer manual setup:

1. **Backend setup:**
   ```bash
   cd backend
   python -m pip install -r requirements.txt
   python scripts/init_db.py
   python scripts/populate_db.py
   python -m uvicorn app.main:app --reload --port 8000
   ```

2. **Frontend setup:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Available Commands

Use the Makefile for common development tasks:

```bash
# Installation
make install              # Install all dependencies
make install-backend     # Install backend dependencies only
make install-frontend    # Install frontend dependencies only

# Development
make dev                 # Start both frontend and backend
make dev-backend        # Start backend only
make dev-frontend       # Start frontend only

# Database management
make init-db            # Initialize database schema
make populate-db        # Populate with mock data
make reset-db          # Reset database (drop and recreate)

# Testing and building
make test              # Run backend tests
make build            # Build frontend for production
make clean           # Clean up generated files

# Complete setup
make setup           # Full setup: install + init-db + populate-db
```

## API Endpoints

The backend provides the following REST API endpoints:

- `GET /api/commits` - List commits
- `GET /api/commits/{sha}` - Get specific commit
- `GET /api/binaries` - List binary configurations
- `GET /api/runs` - List benchmark runs
- `GET /api/benchmark-results` - List enriched benchmark results
- `GET /api/diff` - Get diff table data
- `GET /api/python-versions` - Get available Python versions
- `POST /api/upload` - Upload new benchmark results

## Data Model

The application uses the following core entities:

- **Commit**: Git commit with Python version and metadata
- **Binary**: Compilation flag configuration
- **Run**: Execution of benchmarks for a specific commit and binary
- **BenchmarkResult**: Individual benchmark results with memory metrics

## Development

### Adding New Binary Configurations

Binary configurations can be added via the API or directly in the database:

```python
# Example: Add a new binary configuration
{
    "id": "custom-flags",
    "name": "Custom Flags",
    "flags": ["--enable-shared", "--with-computed-gotos"]
}
```

### Database Schema

The SQLite database includes:
- `commits` - Git commits with Python versions
- `binaries` - Compilation flag sets
- `runs` - Benchmark execution metadata
- `benchmark_results` - Individual benchmark metrics

### Frontend Components

Key frontend components:
- `trends/page.tsx` - Benchmark trend visualization
- `diff/page.tsx` - Commit comparison table
- `binaries/page.tsx` - Binary configuration viewer
- `lib/api.ts` - API client for backend communication

## Deployment

### Production Build

```bash
# Build frontend for production
make build

# Start production servers
cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
cd frontend && npm start
```

### Environment Variables

Create `.env.local` in the frontend directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `make test`
5. Submit a pull request

## License

MIT License - see LICENSE file for details.