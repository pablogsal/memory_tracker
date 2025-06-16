export interface Commit {
  sha: string;
  timestamp: string; // ISO datetime string
  message: string;
  author: string;
}

export interface PythonVersion {
  major: number;
  minor: number;
  patch: number;
}

// Represents a set of compilation flags, not a specific Python version instance
export interface Binary {
  id: string; // e.g., "debug-flags", "no-gil-flags", "default"
  name: string; // User-friendly name, e.g., "Debug Flags", "No GIL"
  flags: string[];
}

export interface Run {
  run_id: string;
  commit_sha: string;
  binary_id: string; // Refers to Binary.id (the identifier for a set of flags)
  python_version: PythonVersion; // Specific Python version used for this run
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
  // Ensure benchmark_name can be part of result_json if needed, or it's primarily on BenchmarkResult
  benchmark_name?: string;
}

export interface BenchmarkResult {
  id: string; // Unique ID for the result, e.g. run_id + benchmark_name
  run_id: string;
  benchmark_name: string;
  result_json: BenchmarkResultJson;
}

// Combined type for easier display
export interface EnrichedBenchmarkResult extends BenchmarkResult {
  commit: Commit;
  binary: Binary; // The flag set used for the run
  run_python_version: PythonVersion; // The Python version of the run
}

export interface DiffTableRow {
  benchmark_name: string;
  // prev_commit_sha and curr_commit_sha removed as context is a single selected commit
  metric_delta_percent?: number; // Percentage
  prev_metric_value?: number;
  curr_metric_value: number;
  // prev_commit and curr_commit objects for detailed info if needed elsewhere, but not directly in table rows
  prev_commit_details?: Commit;
  curr_commit_details: Commit;
  metric_key: keyof BenchmarkResultJson;
  // Specific Python versions used for the comparison
  prev_python_version_str?: string;
  curr_python_version_str: string;
}

export type MetricKey = keyof Pick<BenchmarkResultJson, 'high_watermark_bytes' | 'total_allocated_bytes'>;

export const METRIC_OPTIONS: { value: MetricKey; label: string }[] = [
  { value: 'high_watermark_bytes', label: 'High Watermark (Bytes)' },
  { value: 'total_allocated_bytes', label: 'Total Allocated (Bytes)' },
];

// For filtering by major.minor
export interface PythonVersionFilterOption {
  label: string; // e.g., "3.12"
  major: number;
  minor: number;
}
