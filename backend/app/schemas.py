from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime


class PythonVersion(BaseModel):
    major: int
    minor: int
    patch: int


class CommitBase(BaseModel):
    sha: str
    timestamp: datetime
    message: str
    author: str
    python_version: PythonVersion


class CommitCreate(CommitBase):
    pass


class Commit(CommitBase):
    class Config:
        from_attributes = True


class BinaryBase(BaseModel):
    id: str
    name: str
    flags: List[str]


class BinaryCreate(BinaryBase):
    pass


class Binary(BinaryBase):
    class Config:
        from_attributes = True


class EnvironmentBase(BaseModel):
    id: str
    name: str
    description: Optional[str] = None


class EnvironmentCreate(EnvironmentBase):
    pass


class Environment(EnvironmentBase):
    class Config:
        from_attributes = True


class RunBase(BaseModel):
    run_id: str
    commit_sha: str
    binary_id: str
    environment_id: str
    python_version: PythonVersion
    timestamp: datetime


class RunCreate(RunBase):
    pass


class Run(RunBase):
    class Config:
        from_attributes = True


class TopAllocatingFunction(BaseModel):
    function: str
    count: int
    total_size: int


class BenchmarkResultJson(BaseModel):
    high_watermark_bytes: int
    allocation_histogram: List[Tuple[int, int]]
    total_allocated_bytes: int
    top_allocating_functions: List[TopAllocatingFunction]
    benchmark_name: Optional[str] = None


class BenchmarkResultBase(BaseModel):
    id: str
    run_id: str
    benchmark_name: str
    result_json: BenchmarkResultJson


class BenchmarkResultCreate(BaseModel):
    run_id: str
    benchmark_name: str
    result_json: BenchmarkResultJson


class BenchmarkResult(BenchmarkResultBase):
    class Config:
        from_attributes = True


class EnrichedBenchmarkResult(BenchmarkResult):
    commit: Commit
    binary: Binary
    environment: Environment
    run_python_version: PythonVersion


class DiffTableRow(BaseModel):
    benchmark_name: str
    metric_delta_percent: Optional[float] = None
    prev_metric_value: Optional[int] = None
    curr_metric_value: int
    curr_commit_details: Commit
    prev_commit_details: Optional[Commit] = None
    metric_key: str
    prev_python_version_str: Optional[str] = None
    curr_python_version_str: str


class PythonVersionFilterOption(BaseModel):
    label: str
    major: int
    minor: int


class BenchmarkUpload(BaseModel):
    commit_sha: str
    binary_id: str
    environment_id: str
    python_version: PythonVersion
    benchmark_results: List[BenchmarkResultJson]