export type PythonVersion = {
  major: number;
  minor: number;
  patch: number;
};

export type Binary = {
  id: string;
  name: string;
  flags: string[];
  description?: string;
};

export type Environment = {
  id: string;
  name: string;
  description?: string;
};

export type Commit = {
  sha: string;
  timestamp: string;
  message: string;
  author: string;
  python_version: PythonVersion;
  prev_commit?: Commit;
};

export type PythonVersionFilterOption = {
  label: string;
  major: number;
  minor: number;
};

export type MetricKey = 'high_watermark_bytes' | 'total_allocated_bytes';

export const METRIC_OPTIONS = [
  { label: 'High Watermark', value: 'high_watermark_bytes' },
  { label: 'Total Allocated', value: 'total_allocated_bytes' },
] as const;

export type TopAllocatingFunction = {
  function: string;
  count: number;
  total_size: number;
};

export type BenchmarkResultJson = {
  high_watermark_bytes: number;
  allocation_histogram: [number, number][];
  total_allocated_bytes: number;
  top_allocating_functions: TopAllocatingFunction[];
  benchmark_name?: string;
};

export type EnrichedBenchmarkResult = {
  id: string;
  run_id: string;
  benchmark_name: string;
  result_json: BenchmarkResultJson;
  commit: Commit;
  binary: Binary;
  environment: Environment;
  run_python_version: PythonVersion;
};

export type DiffTableRow = {
  benchmark_name: string;
  metric_delta_percent?: number;
  prev_metric_value?: number;
  curr_metric_value: number;
  curr_commit_details: Commit;
  prev_commit_details?: Commit;
  metric_key: MetricKey;
  prev_python_version_str?: string;
  curr_python_version_str: string;
  curr_result_id: string;
}; 