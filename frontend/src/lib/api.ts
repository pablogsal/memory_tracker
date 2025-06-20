import type {
  Binary,
  Commit,
  DiffTableRow,
  EnrichedBenchmarkResult,
  Environment,
  PythonVersionFilterOption,
  BenchmarkResultJson,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(response.status, `API error: ${response.statusText}`);
  }

  return response.json();
}

export const api = {
  // Commit endpoints
  getCommits: (skip: number = 0, limit: number = 100) =>
    fetchApi<Commit[]>(`/api/commits?skip=${skip}&limit=${limit}`),
  getCommit: (sha: string) => fetchApi<Commit>(`/api/commits/${sha}`),

  // Binary endpoints
  getBinaries: () => fetchApi<Binary[]>('/api/binaries'),
  getBinary: (id: string) => fetchApi<Binary>(`/api/binaries/${id}`),
  getEnvironmentsForBinary: (binaryId: string) =>
    fetchApi<
      Array<{
        id: string;
        name: string;
        description?: string;
        run_count: number;
        commit_count: number;
      }>
    >(`/api/binaries/${binaryId}/environments`),
  getCommitsForBinaryAndEnvironment: (
    binaryId: string,
    environmentId: string
  ) =>
    fetchApi<
      Array<{
        sha: string;
        timestamp: string;
        message: string;
        author: string;
        python_version: { major: number; minor: number; patch: number };
        run_timestamp: string;
      }>
    >(`/api/binaries/${binaryId}/environments/${environmentId}/commits`),

  // Environment endpoints
  getEnvironments: () => fetchApi<Environment[]>('/api/environments'),
  getEnvironment: (id: string) =>
    fetchApi<Environment>(`/api/environments/${id}`),

  // Python version endpoints
  getPythonVersions: () =>
    fetchApi<PythonVersionFilterOption[]>('/api/python-versions'),

  // Benchmark endpoints
  getAllBenchmarks: () => fetchApi<string[]>('/api/benchmarks'),
  getBenchmarkNames: (params: {
    environment_id: string;
    binary_id: string;
    python_major: number;
    python_minor: number;
  }) => {
    const queryParams = new URLSearchParams();
    queryParams.append('environment_id', params.environment_id);
    queryParams.append('binary_id', params.binary_id);
    queryParams.append('python_major', params.python_major.toString());
    queryParams.append('python_minor', params.python_minor.toString());

    return fetchApi<string[]>(`/api/benchmark-names?${queryParams.toString()}`);
  },

  // Diff endpoint
  getDiffTable: (params: {
    commit_sha: string;
    binary_id: string;
    environment_id: string;
    metric_key: string;
  }) => {
    const queryParams = new URLSearchParams();
    queryParams.append('commit_sha', params.commit_sha);
    queryParams.append('binary_id', params.binary_id);
    queryParams.append('environment_id', params.environment_id);
    queryParams.append('metric_key', params.metric_key);

    return fetchApi<DiffTableRow[]>(`/api/diff?${queryParams.toString()}`);
  },

  // Upload endpoint
  uploadBenchmarkResults: (data: {
    commit_sha: string;
    binary_id: string;
    environment_id: string;
    python_version: {
      major: number;
      minor: number;
      patch: number;
    };
    benchmark_results: BenchmarkResultJson[];
  }) =>
    fetchApi<{ success: boolean }>('/api/upload', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Optimized trends endpoint
  getBenchmarkTrends: (params: {
    benchmark_name: string;
    binary_id: string;
    environment_id: string;
    limit?: number;
  }) => {
    const queryParams = new URLSearchParams();
    queryParams.append('benchmark_name', params.benchmark_name);
    queryParams.append('binary_id', params.binary_id);
    queryParams.append('environment_id', params.environment_id);
    if (params.limit) queryParams.append('limit', params.limit.toString());

    return fetchApi<
      Array<{
        sha: string;
        timestamp: string;
        python_version: string;
        high_watermark_bytes: number;
        total_allocated_bytes: number;
      }>
    >(`/api/trends?${queryParams.toString()}`);
  },

  // Batch trends endpoint
  getBatchBenchmarkTrends: (
    trendQueries: Array<{
      benchmark_name: string;
      binary_id: string;
      environment_id: string;
      limit?: number;
    }>
  ) => {
    return fetchApi<{
      results: Record<
        string,
        Array<{
          sha: string;
          timestamp: string;
          python_version: string;
          high_watermark_bytes: number;
          total_allocated_bytes: number;
        }>
      >;
    }>('/api/trends-batch', {
      method: 'POST',
      body: JSON.stringify({
        trend_queries: trendQueries.map((query) => ({
          benchmark_name: query.benchmark_name,
          binary_id: query.binary_id,
          environment_id: query.environment_id,
          limit: query.limit || 50,
        })),
      }),
    });
  },

  // Flamegraph endpoint
  getFlamegraph: (id: string) =>
    fetchApi<{ flamegraph_html: string }>(`/api/flamegraph/${id}`),
};

export { ApiError };
