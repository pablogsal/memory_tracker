from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Annotated
from datetime import datetime
import uuid
import logging

from . import crud, models, schemas
from .database import get_database, create_tables

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

app = FastAPI(title="CPython Memory Tracker API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:9002", "http://127.0.0.1:9002"],  # Frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add request logging middleware
@app.middleware("http")
async def log_requests(request, call_next):
    logger = logging.getLogger("api")
    start_time = datetime.now()
    
    # Log the incoming request
    logger.info(f"→ {request.method} {request.url.path}")
    if request.query_params:
        logger.info(f"  Query params: {dict(request.query_params)}")
    
    # Process the request
    response = await call_next(request)
    
    # Log the response
    process_time = (datetime.now() - start_time).total_seconds()
    logger.info(f"← {response.status_code} {request.method} {request.url.path} ({process_time:.3f}s)")
    
    return response


@app.on_event("startup")
async def startup_event():
    await create_tables()


# Authentication
security = HTTPBearer(auto_error=False)

async def get_current_token(
    authorization: Annotated[str, Header()] = None,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_database)
) -> models.AuthToken:
    """
    Extract and validate auth token from Authorization header.
    Supports both 'Bearer <token>' and 'Token <token>' formats.
    """
    token = None
    
    # Try to extract token from Authorization header
    if authorization:
        if authorization.startswith("Bearer "):
            token = authorization[7:]  # Remove "Bearer " prefix
        elif authorization.startswith("Token "):
            token = authorization[6:]  # Remove "Token " prefix
        else:
            # Assume the entire header is the token
            token = authorization
    elif credentials:
        token = credentials.credentials
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Look up token in database
    auth_token = await crud.get_auth_token_by_token(db, token)
    if not auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Update last used timestamp
    await crud.update_token_last_used(db, token)
    
    return auth_token


# Commits endpoints
@app.get("/api/commits", response_model=List[schemas.Commit])
async def get_commits(
    skip: int = 0, 
    limit: int = 100, 
    db: AsyncSession = Depends(get_database)
):
    logger = logging.getLogger(__name__)
    logger.info(f"Fetching commits (skip={skip}, limit={limit})")
    commits = await crud.get_commits(db, skip=skip, limit=limit)
    logger.info(f"Found {len(commits)} commits")
    return [
        schemas.Commit(
            sha=commit.sha,
            timestamp=commit.timestamp,
            message=commit.message,
            author=commit.author,
            python_version=schemas.PythonVersion(
                major=commit.python_major,
                minor=commit.python_minor,
                patch=commit.python_patch
            )
        )
        for commit in commits
    ]


@app.get("/api/commits/{sha}", response_model=schemas.Commit)
async def get_commit(sha: str, db: AsyncSession = Depends(get_database)):
    logger = logging.getLogger(__name__)
    logger.info(f"Fetching commit by SHA: {sha}")
    commit = await crud.get_commit_by_sha(db, sha=sha)
    if commit is None:
        logger.warning(f"Commit not found: {sha}")
        raise HTTPException(status_code=404, detail="Commit not found")
    
    logger.info(f"Found commit: {commit.sha[:8]} by {commit.author}")
    return schemas.Commit(
        sha=commit.sha,
        timestamp=commit.timestamp,
        message=commit.message,
        author=commit.author,
        python_version=schemas.PythonVersion(
            major=commit.python_major,
            minor=commit.python_minor,
            patch=commit.python_patch
        )
    )


# Binaries endpoints
@app.get("/api/binaries", response_model=List[schemas.Binary])
async def get_binaries(db: AsyncSession = Depends(get_database)):
    logger = logging.getLogger(__name__)
    logger.info("Fetching all binaries")
    binaries = await crud.get_binaries(db)
    logger.info(f"Found {len(binaries)} binaries")
    return [
        schemas.Binary(id=binary.id, name=binary.name, flags=binary.flags, description=binary.description)
        for binary in binaries
    ]


@app.get("/api/binaries/{binary_id}", response_model=schemas.Binary)
async def get_binary(binary_id: str, db: AsyncSession = Depends(get_database)):
    logger = logging.getLogger(__name__)
    logger.info(f"Fetching binary: {binary_id}")
    binary = await crud.get_binary_by_id(db, binary_id=binary_id)
    if binary is None:
        logger.warning(f"Binary not found: {binary_id}")
        raise HTTPException(status_code=404, detail="Binary not found")
    
    logger.info(f"Found binary: {binary.name} with {len(binary.flags)} flags")
    return schemas.Binary(id=binary.id, name=binary.name, flags=binary.flags, description=binary.description)


@app.get("/api/binaries/{binary_id}/environments", response_model=List[dict])
async def get_environments_for_binary(binary_id: str, db: AsyncSession = Depends(get_database)):
    binary = await crud.get_binary_by_id(db, binary_id=binary_id)
    if binary is None:
        raise HTTPException(status_code=404, detail="Binary not found")
    
    environments = await crud.get_environments_for_binary(db, binary_id=binary_id)
    return environments


@app.get("/api/binaries/{binary_id}/environments/{environment_id}/commits", response_model=List[dict])
async def get_commits_for_binary_and_environment(
    binary_id: str, 
    environment_id: str, 
    db: AsyncSession = Depends(get_database)
):
    binary = await crud.get_binary_by_id(db, binary_id=binary_id)
    if binary is None:
        raise HTTPException(status_code=404, detail="Binary not found")
    
    environment = await crud.get_environment_by_id(db, environment_id=environment_id)
    if environment is None:
        raise HTTPException(status_code=404, detail="Environment not found")
    
    commits = await crud.get_commits_for_binary_and_environment(db, binary_id=binary_id, environment_id=environment_id)
    return commits


# Environments endpoints
@app.get("/api/environments", response_model=List[schemas.Environment])
async def get_environments(db: AsyncSession = Depends(get_database)):
    environments = await crud.get_environments(db)
    return [
        schemas.Environment(id=env.id, name=env.name, description=env.description)
        for env in environments
    ]


@app.get("/api/environments/{environment_id}", response_model=schemas.Environment)
async def get_environment(environment_id: str, db: AsyncSession = Depends(get_database)):
    environment = await crud.get_environment_by_id(db, environment_id=environment_id)
    if environment is None:
        raise HTTPException(status_code=404, detail="Environment not found")
    
    return schemas.Environment(id=environment.id, name=environment.name, description=environment.description)


# Runs endpoints
@app.get("/api/runs", response_model=List[schemas.Run])
async def get_runs(
    commit_sha: Optional[str] = None,
    binary_id: Optional[str] = None,
    environment_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_database)
):
    runs = await crud.get_runs(db, commit_sha=commit_sha, binary_id=binary_id, environment_id=environment_id, skip=skip, limit=limit)
    return [
        schemas.Run(
            run_id=run.run_id,
            commit_sha=run.commit_sha,
            binary_id=run.binary_id,
            environment_id=run.environment_id,
            python_version=schemas.PythonVersion(
                major=run.python_major,
                minor=run.python_minor,
                patch=run.python_patch
            ),
            timestamp=run.timestamp
        )
        for run in runs
    ]


# Benchmark results endpoints
@app.get("/api/benchmark-results", response_model=List[schemas.EnrichedBenchmarkResult])
async def get_benchmark_results(
    benchmark_name: Optional[str] = None,
    binary_id: Optional[str] = None,
    environment_id: Optional[str] = None,
    python_major: Optional[int] = None,
    python_minor: Optional[int] = None,
    skip: int = 0,
    limit: int = 10000,
    db: AsyncSession = Depends(get_database)
):
    logger = logging.getLogger(__name__)
    filters = []
    if benchmark_name:
        filters.append(f"benchmark={benchmark_name}")
    if binary_id:
        filters.append(f"binary={binary_id}")
    if environment_id:
        filters.append(f"environment={environment_id}")
    if python_major:
        filters.append(f"python={python_major}.{python_minor or 'x'}")
    
    filter_str = f" with filters: {', '.join(filters)}" if filters else ""
    logger.info(f"Fetching benchmark results (skip={skip}, limit={limit}){filter_str}")
    results = await crud.get_enriched_benchmark_results(
        db, 
        benchmark_name=benchmark_name,
        binary_id=binary_id,
        environment_id=environment_id,
        python_major=python_major,
        python_minor=python_minor,
        skip=skip, 
        limit=limit
    )
    
    logger.info(f"Found {len(results)} benchmark results")
    return [
        schemas.EnrichedBenchmarkResult(
            id=result["id"],
            run_id=result["run_id"],
            benchmark_name=result["benchmark_name"],
            result_json=schemas.BenchmarkResultJson(**result["result_json"]),
            commit=schemas.Commit(**result["commit"]),
            binary=schemas.Binary(**result["binary"]),
            environment=schemas.Environment(**result["environment"]),
            run_python_version=schemas.PythonVersion(**result["run_python_version"])
        )
        for result in results
    ]


# Diff table endpoint
@app.get("/api/diff", response_model=List[schemas.DiffTableRow])
async def get_diff_table(
    commit_sha: str,
    binary_id: str,
    environment_id: str,
    metric_key: str = "high_watermark_bytes",
    db: AsyncSession = Depends(get_database)
):
    # Get the selected commit
    selected_commit = await crud.get_commit_by_sha(db, sha=commit_sha)
    if not selected_commit:
        raise HTTPException(status_code=404, detail="Commit not found")
    
    # Get all benchmark names for this commit, binary, and environment
    runs = await crud.get_runs(db, commit_sha=commit_sha, binary_id=binary_id, environment_id=environment_id)
    if not runs:
        raise HTTPException(status_code=404, detail="No runs found for this commit, binary, and environment")
    
    current_run = runs[0]  # Get the latest run
    current_results = await crud.get_benchmark_results(db, run_id=current_run.run_id)
    
    # Efficiently find the previous commit that was tested with the same binary and environment
    prev_commit = await crud.get_previous_commit_with_binary_and_environment(db, selected_commit, binary_id, environment_id)
    
    rows = []
    for result in current_results:
        curr_metric_value = getattr(result, metric_key, 0)
        
        row_data = {
            "benchmark_name": result.benchmark_name,
            "curr_metric_value": curr_metric_value,
            "curr_commit_details": schemas.Commit(
                sha=selected_commit.sha,
                timestamp=selected_commit.timestamp,
                message=selected_commit.message,
                author=selected_commit.author,
                python_version=schemas.PythonVersion(
                    major=selected_commit.python_major,
                    minor=selected_commit.python_minor,
                    patch=selected_commit.python_patch
                )
            ),
            "metric_key": metric_key,
            "curr_python_version_str": f"{selected_commit.python_major}.{selected_commit.python_minor}.{selected_commit.python_patch}",
            "curr_result_id": result.id,
        }
        
        # Try to find previous commit's data for comparison
        if prev_commit:
            
            prev_runs = await crud.get_runs(db, commit_sha=prev_commit.sha, binary_id=binary_id, environment_id=environment_id)
            if prev_runs:
                prev_results = await crud.get_benchmark_results(db, run_id=prev_runs[0].run_id)
                prev_result = next((r for r in prev_results if r.benchmark_name == result.benchmark_name), None)
                
                if prev_result:
                    prev_metric_value = getattr(prev_result, metric_key, 0)
                    row_data.update({
                        "prev_metric_value": prev_metric_value,
                        "prev_commit_details": schemas.Commit(
                            sha=prev_commit.sha,
                            timestamp=prev_commit.timestamp,
                            message=prev_commit.message,
                            author=prev_commit.author,
                            python_version=schemas.PythonVersion(
                                major=prev_commit.python_major,
                                minor=prev_commit.python_minor,
                                patch=prev_commit.python_patch
                            )
                        ),
                        "prev_python_version_str": f"{prev_commit.python_major}.{prev_commit.python_minor}.{prev_commit.python_patch}",
                    })
                    
                    if prev_metric_value > 0:
                        row_data["metric_delta_percent"] = ((curr_metric_value - prev_metric_value) / prev_metric_value) * 100
        
        rows.append(schemas.DiffTableRow(**row_data))
    
    return rows


# Python version filters endpoint
@app.get("/api/python-versions", response_model=List[schemas.PythonVersionFilterOption])
async def get_python_versions(db: AsyncSession = Depends(get_database)):
    versions = await crud.get_python_version_filters(db)
    return [schemas.PythonVersionFilterOption(**version) for version in versions]


# Upload benchmark results endpoint (legacy)
@app.post("/api/upload", response_model=dict)
async def upload_benchmark_results(
    upload_data: schemas.BenchmarkUpload,
    db: AsyncSession = Depends(get_database)
):
    # Check if commit exists, create if not
    commit = await crud.get_commit_by_sha(db, sha=upload_data.commit_sha)
    if not commit:
        raise HTTPException(
            status_code=400, 
            detail=f"Commit {upload_data.commit_sha} not found. Please create the commit first."
        )
    
    # Check if binary exists
    binary = await crud.get_binary_by_id(db, binary_id=upload_data.binary_id)
    if not binary:
        raise HTTPException(
            status_code=400, 
            detail=f"Binary {upload_data.binary_id} not found. Please create the binary first."
        )
    
    # Check if environment exists
    environment = await crud.get_environment_by_id(db, environment_id=upload_data.environment_id)
    if not environment:
        raise HTTPException(
            status_code=400, 
            detail=f"Environment {upload_data.environment_id} not found. Please create the environment first."
        )
    
    # Create a new run
    run_id = f"run_{upload_data.commit_sha[:8]}_{upload_data.binary_id}_{upload_data.environment_id}_{int(datetime.now().timestamp())}"
    run_data = schemas.RunCreate(
        run_id=run_id,
        commit_sha=upload_data.commit_sha,
        binary_id=upload_data.binary_id,
        environment_id=upload_data.environment_id,
        python_version=upload_data.python_version,
        timestamp=datetime.now()
    )
    
    try:
        new_run = await crud.create_run(db, run_data)
        
        # Create benchmark results
        created_results = []
        for benchmark_result in upload_data.benchmark_results:
            result_data = schemas.BenchmarkResultCreate(
                run_id=run_id,
                benchmark_name=benchmark_result.benchmark_name or "unknown",
                result_json=benchmark_result
            )
            created_result = await crud.create_benchmark_result(db, result_data)
            created_results.append(created_result.id)
        
        return {
            "message": "Benchmark results uploaded successfully",
            "run_id": run_id,
            "results_created": len(created_results),
            "result_ids": created_results
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload benchmark results: {str(e)}")


# Worker upload endpoint with validation (requires authentication)
@app.post("/api/upload-run", response_model=dict)
async def upload_worker_run(
    upload_data: schemas.WorkerRunUpload,
    db: AsyncSession = Depends(get_database),
    current_token: models.AuthToken = Depends(get_current_token)
):
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"Authenticated upload request from token '{current_token.name}' for binary_id='{upload_data.binary_id}', environment_id='{upload_data.environment_id}'")
    logger.debug(f"Upload contains {len(upload_data.benchmark_results)} benchmark results")
    
    metadata = upload_data.metadata
    
    # Extract commit information
    commit_info = metadata.get("commit", {})
    commit_sha = commit_info.get("hexsha")
    if not commit_sha:
        logger.error("Upload failed: Missing commit SHA in metadata")
        raise HTTPException(status_code=400, detail="Missing commit SHA in metadata")
    
    logger.info(f"Processing upload for commit {commit_sha[:8]}")
    
    # Extract Python version
    version_info = metadata.get("version", {})
    python_version = schemas.PythonVersion(
        major=version_info.get("major"),
        minor=version_info.get("minor"),
        patch=version_info.get("micro", 0)  # 'micro' in metadata maps to 'patch' in our schema
    )
    logger.debug(f"Extracted Python version: {python_version.major}.{python_version.minor}.{python_version.patch}")
    
    # Use provided binary_id and environment_id from worker
    binary_id = upload_data.binary_id
    environment_id = upload_data.environment_id
    
    # Validate binary exists
    logger.debug(f"Validating binary '{binary_id}' exists")
    binary = await crud.get_binary_by_id(db, binary_id=binary_id)
    if not binary:
        logger.error(f"Upload failed: Binary '{binary_id}' not found")
        raise HTTPException(
            status_code=400, 
            detail=f"Binary '{binary_id}' not found. Binaries must be pre-registered."
        )
    logger.info(f"Binary '{binary_id}' validated successfully")
    
    # Validate environment exists
    logger.debug(f"Validating environment '{environment_id}' exists")
    environment = await crud.get_environment_by_id(db, environment_id=environment_id)
    if not environment:
        logger.error(f"Upload failed: Environment '{environment_id}' not found")
        raise HTTPException(
            status_code=400, 
            detail=f"Environment '{environment_id}' not found. Environments must be pre-registered."
        )
    logger.info(f"Environment '{environment_id}' validated successfully")
    
    # Validate configure flags - the registered binary flags must be a subset of uploaded flags
    configure_vars = metadata.get("configure_vars", {})
    uploaded_config_args = configure_vars.get("CONFIG_ARGS", "")
    uploaded_flags = set(uploaded_config_args.split()) if uploaded_config_args else set()
    registered_flags = set(binary.flags) if binary.flags else set()
    
    logger.debug(f"Configure flags validation: registered={sorted(registered_flags)}, uploaded={sorted(uploaded_flags)}")
    logger.debug(f"Raw CONFIG_ARGS from metadata: '{uploaded_config_args}'")
    
    # Check if registered flags are a subset of uploaded flags
    if registered_flags and not registered_flags.issubset(uploaded_flags):
        missing_flags = registered_flags - uploaded_flags
        logger.error(f"Upload failed: Configure flags mismatch for binary '{binary_id}'. "
                    f"Missing flags: {sorted(missing_flags)}, "
                    f"Required: {sorted(registered_flags)}, "
                    f"Provided: {sorted(uploaded_flags)}")
        raise HTTPException(
            status_code=400,
            detail=f"Binary '{binary_id}' requires configure flags {sorted(missing_flags)} but upload only has {sorted(uploaded_flags)}. "
                   f"Registered configure flags {sorted(registered_flags)} must be a subset of upload configure flags."
        )
    logger.info(f"Configure flags validation passed for binary '{binary_id}'")
    
    # Create or get commit
    logger.debug(f"Looking up commit {commit_sha[:8]} in database")
    commit = await crud.get_commit_by_sha(db, sha=commit_sha)
    if not commit:
        logger.info(f"Commit {commit_sha[:8]} not found, creating new commit record")
        # Create commit from metadata
        commit_data = schemas.CommitCreate(
            sha=commit_sha,
            timestamp=datetime.fromisoformat(commit_info.get("committed_date", "").replace("Z", "+00:00")),
            message=commit_info.get("message", ""),
            author=commit_info.get("author", ""),
            python_version=python_version
        )
        try:
            commit = await crud.create_commit(db, commit_data)
            logger.info(f"Successfully created commit record for {commit_sha[:8]}")
        except Exception as e:
            logger.error(f"Failed to create commit record for {commit_sha[:8]}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to create commit record: {str(e)}")
    else:
        logger.debug(f"Found existing commit record for {commit_sha[:8]}")
    
    # Create run
    run_id = f"run_{commit_sha[:8]}_{binary_id}_{environment_id}_{int(datetime.now().timestamp())}"
    logger.info(f"Creating run with ID: {run_id}")
    run_data = schemas.RunCreate(
        run_id=run_id,
        commit_sha=commit_sha,
        binary_id=binary_id,
        environment_id=environment_id,
        python_version=python_version,
        timestamp=datetime.now()
    )
    
    try:
        new_run = await crud.create_run(db, run_data)
        logger.info(f"Successfully created run record: {run_id}")
        
        # Create benchmark results
        created_results = []
        logger.info(f"Processing {len(upload_data.benchmark_results)} benchmark results")
        for i, benchmark_result in enumerate(upload_data.benchmark_results, 1):
            logger.debug(f"Processing benchmark result {i}/{len(upload_data.benchmark_results)}: {benchmark_result.benchmark_name}")
            # Convert worker format to internal format
            stats_json = benchmark_result.stats_json
            
            # Extract key metrics from the stats JSON
            result_json = schemas.BenchmarkResultJson(
                high_watermark_bytes=stats_json.get("metadata", {}).get("peak_memory", 0),
                allocation_histogram=[[item["min_bytes"], item["count"]] 
                                    for item in stats_json.get("allocation_size_histogram", [])],
                total_allocated_bytes=stats_json.get("total_bytes_allocated", 0),
                top_allocating_functions=[
                    schemas.TopAllocatingFunction(
                        function=alloc["location"],
                        count=alloc.get("count", 0),
                        total_size=alloc["size"]
                    )
                    for alloc in stats_json.get("top_allocations_by_size", [])[:10]
                ],
                benchmark_name=benchmark_result.benchmark_name
            )
            
            result_data = schemas.BenchmarkResultCreate(
                run_id=run_id,
                benchmark_name=benchmark_result.benchmark_name,
                result_json=result_json,
                flamegraph_html=benchmark_result.flamegraph_html
            )
            try:
                created_result = await crud.create_benchmark_result(db, result_data)
                created_results.append(created_result.id)
                logger.debug(f"Successfully created benchmark result for {benchmark_result.benchmark_name}")
            except Exception as e:
                logger.error(f"Failed to create benchmark result for {benchmark_result.benchmark_name}: {e}")
                raise
        
        logger.info(f"Upload completed successfully: run_id={run_id}, created {len(created_results)} benchmark results")
        
        return {
            "message": "Worker run uploaded successfully",
            "run_id": run_id,
            "commit_sha": commit_sha,
            "binary_id": binary_id,
            "environment_id": environment_id,
            "results_created": len(created_results),
            "result_ids": created_results
        }
    
    except HTTPException:
        # Re-raise HTTP exceptions (validation errors) as-is
        raise
    except Exception as e:
        logger.error(f"Unexpected error during upload processing: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload worker run: {str(e)}")


# Flamegraph endpoint
@app.get("/api/flamegraph/{result_id}", response_model=dict)
async def get_flamegraph(result_id: str, db: AsyncSession = Depends(get_database)):
    result = await crud.get_benchmark_result_by_id(db, result_id=result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Benchmark result not found")
    
    return {
        "flamegraph_html": result.flamegraph_html or "",
        "benchmark_name": result.benchmark_name,
        "result_id": result_id
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)