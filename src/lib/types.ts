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

export interface Binary {
  id: string; // e.g., "3.12.0-debug-nogil"
  version: PythonVersion;
  flags: string[];
}

export interface Run {
  run_id: string;
  commit_sha: string;
  binary_id: string;
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
  binary: Binary;
}

export interface DiffTableRow {
  benchmark_name: string;
  prev_commit_sha?: string;
  curr_commit_sha: string;
  metric_delta_percent?: number; // Percentage
  prev_metric_value?: number;
  curr_metric_value: number;
  prev_commit?: Commit;
  curr_commit: Commit;
  metric_key: keyof BenchmarkResultJson; // e.g. "high_watermark_bytes"
}

export type MetricKey = keyof Pick<BenchmarkResultJson, 'high_watermark_bytes' | 'total_allocated_bytes'>;

export const METRIC_OPTIONS: { value: MetricKey; label: string }[] = [
  { value: 'high_watermark_bytes', label: 'High Watermark (Bytes)' },
  { value: 'total_allocated_bytes', label: 'Total Allocated (Bytes)' },
];
