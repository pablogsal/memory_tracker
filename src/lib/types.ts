export interface PythonVersion {
  major: number;
  minor: number;
  patch: number;
}

export interface Commit {
  sha: string;
  timestamp: string; // ISO datetime string
  message: string;
  author: string;
  python_version: PythonVersion; // Each commit is built FOR a specific Python version
}

// Represents a set of compilation flags, independent of Python version
export interface Binary {
  id: string; // e.g., "debug-flags", "no-gil-flags", "default"
  name: string; // User-friendly name, e.g., "Debug Flags", "No GIL"
  flags: string[];
}

export interface Run {
  run_id: string;
  commit_sha: string;
  binary_id: string; // Refers to Binary.id (the identifier for a set of flags)
  // The python_version for a run must match the python_version of its commit
  python_version: PythonVersion; 
  timestamp: string; // ISO datetime string
}

export interface TopAllocatingFunction {
  function: string;
  count: number;
  total_size: number;
}

export interface BenchmarkResultJson {
  high_watermark_bytes: number;
  allocation_histogram: [number, number][]; // [size, count]
  total_allocated_bytes: number;
  top_allocating_functions: TopAllocatingFunction[];
  benchmark_name?: string; 
}

export interface BenchmarkResult {
  id: string; 
  run_id: string;
  benchmark_name: string;
  result_json: BenchmarkResultJson;
}

export interface EnrichedBenchmarkResult extends BenchmarkResult {
  commit: Commit;
  binary: Binary; 
  run_python_version: PythonVersion; // This is the run's Python version, which should match commit's
}

export interface DiffTableRow {
  benchmark_name: string;
  metric_delta_percent?: number; 
  prev_metric_value?: number;
  curr_metric_value: number;
  curr_commit_details: Commit; // Current commit being analyzed
  prev_commit_details?: Commit; // Parent commit, if comparable (same major.minor Python version)
  metric_key: keyof BenchmarkResultJson;
  // Python version strings are for display and derived from the respective commit/run
  prev_python_version_str?: string; 
  curr_python_version_str: string;
}

export type MetricKey = keyof Pick<BenchmarkResultJson, 'high_watermark_bytes' | 'total_allocated_bytes'>;

export const METRIC_OPTIONS: { value: MetricKey; label: string }[] = [
  { value: 'high_watermark_bytes', label: 'High Watermark (Bytes)' },
  { value: 'total_allocated_bytes', label: 'Total Allocated (Bytes)' },
];

// Used for filtering in Trends view, derived from unique major.minor versions in commits
export interface PythonVersionFilterOption {
  label: string; // e.g., "3.12"
  major: number;
  minor: number;
}
